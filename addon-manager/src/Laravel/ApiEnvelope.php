<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ApiEnvelope
{
    public function handle(Request $request, Closure $next): mixed
    {
        if (!str_starts_with($request->path(), 'admin/addon-manager/api/')) {
            return $next($request);
        }
        try {
            $request->headers->set('Accept', 'application/json');
            $response = $next($request);
            // The Panel's 2FA middleware redirects browser GET requests even
            // when Accept requests JSON. Manager fetches omit Content-Type on
            // GET, so translate that rejection into the same API contract.
            if ($response->isRedirection()) {
                $account = parse_url((string) $response->headers->get('Location'), PHP_URL_PATH) === '/account';
                $message = $account
                    ? 'Two-factor authentication is required on this account in order to access this endpoint.'
                    : 'Authentication is required. Refresh the page and sign in again.';
                $response->headers->remove('Location');
                return $this->normalize($response, ['message' => $message], $account ? 400 : 401);
            }
            if ($response->getStatusCode() < 400) {
                return $response;
            }
            // Laravel's routing pipeline renders downstream exceptions through the
            // Panel handler before outer middleware receives the response. Normalize
            // that rendered response too, including CSRF/authentication failures.
            $status = $response->getStatusCode();
            $body = json_decode((string) $response->getContent(), true);
            $message = $status >= 500
                ? 'The manager could not complete this request. Check its operation log or run the standalone doctor.'
                : ($body['message'] ?? $body['errors'][0]['detail'] ?? match ($status) {
                    401 => 'Authentication is required.',
                    403 => 'Root administrator access is required.',
                    404 => 'The requested manager resource was not found.',
                    419 => 'Your session CSRF token has expired. Refresh the page and retry.',
                    default => 'The request was rejected.',
                });
            $envelope = ['message' => $message];
            if ($status === 422 && isset($body['errors'])) {
                $envelope['errors'] = $body['errors'];
            }
            return $this->normalize($response, $envelope, $status);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'The request contains invalid fields.', 'errors' => $e->errors()], 422);
        } catch (HttpExceptionInterface $e) {
            $message = $e->getStatusCode() >= 500
                ? 'The manager could not complete this request. Check its operation log or run the standalone doctor.'
                : ($e->getMessage() ?: 'The request was rejected.');
            if ($e->getStatusCode() >= 500) report($e);
            return response()->json(['message' => $message], $e->getStatusCode(), $e->getHeaders());
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'The manager could not complete this request. Check its operation log or run the standalone doctor.'], 500);
        }
    }

    private function normalize(Response $response, array $body, int $status): Response
    {
        // Retain session cookies and middleware headers when replacing an error
        // body, including logout cookies issued by AuthenticateSession.
        $response->setStatusCode($status);
        $response->setContent(json_encode($body, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $response->headers->set('Content-Type', 'application/json');
        $response->headers->remove('Content-Length');
        return $response;
    }
}
