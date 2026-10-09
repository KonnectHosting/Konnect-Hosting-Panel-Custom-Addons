<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
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
            return response()->json($envelope, $status);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'The request contains invalid fields.', 'errors' => $e->errors()], 422);
        } catch (HttpExceptionInterface $e) {
            return response()->json(['message' => $e->getMessage() ?: 'The request was rejected.'], $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'The manager could not complete this request. Check its operation log or run the standalone doctor.'], 500);
        }
    }
}
