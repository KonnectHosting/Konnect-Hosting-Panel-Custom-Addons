<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Illuminate\Support\Facades\RateLimiter;
use Pterodactyl\Services\Users\UserUpdateService;
use Pterodactyl\Transformers\Api\Client\AccountTransformer;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdateEmailRequest;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdateProfileRequest;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdatePasswordRequest;
use Pterodactyl\Http\Requests\Api\Client\Account\UpdateLanguageRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

class AccountController extends ClientApiController
{
    /**
     * The number of seconds that must elapse before the email change throttle resets.
     */
    private const EMAIL_UPDATE_THROTTLE = 60 * 60 * 24;

    /**
     * AccountController constructor.
     */
    public function __construct(private AuthManager $manager, private UserUpdateService $updateService, private SettingsRepositoryInterface $settings)
    {
        parent::__construct();
    }

    public function index(Request $request): array
    {
        return $this->fractal->item($request->user())
            ->transformWith($this->getTransformer(AccountTransformer::class))
            ->toArray();
    }

    /**
     * Update the authenticated user's email address.
     */
    public function updateEmail(UpdateEmailRequest $request): JsonResponse
    {
        $allowedUpdating = $this->settings->get('settings::arix:advanced:profileCustomization:email', true);
        if (!$allowedUpdating) {
            return new JsonResponse(['errors' => ['email' => 'Updating your email address is not allowed.']], Response::HTTP_BAD_REQUEST);
        }
        $user = $request->user();
        // Only allow a user to change their email three times in the span
        // of 24 hours. This prevents malicious users from trying to find
        // existing accounts in the system by constantly changing their email.
        if (RateLimiter::tooManyAttempts($key = "user:update-email:{$user->uuid}", 3)) {
            throw new TooManyRequestsHttpException(message: 'Your email address has been changed too many times today. Please try again later.');
        }

        $original = $user->email;
        if (mb_strtolower($original) !== mb_strtolower($request->validated('email'))) {
            RateLimiter::hit($key, self::EMAIL_UPDATE_THROTTLE);

            $this->updateService->handle($user, $request->validated());

            Activity::event('user:account.email-changed')
                ->property(['old' => $original, 'new' => $request->validated('email')])
                ->log();
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's profile information.
     */
    public function updateProfileInformation(UpdateProfileRequest $request): JsonResponse
    {
        $allowedUsername = $this->settings->get('settings::arix:advanced:profileCustomization:username', true);

        $original = $request->user()->username;
        $allowedUpdating = $allowedUsername || $original === $request->input('username');

        if (!$allowedUpdating) {
            return new JsonResponse(['errors' => ['username' => 'Updating your username is not allowed.']], Response::HTTP_BAD_REQUEST);
        }

        $allowedName = $this->settings->get('settings::arix:advanced:profileCustomization:name', true);
        $originalName = $request->user()->name_first . ' ' . $request->user()->name_last;
        $newName = $request->input('name_first') . ' ' . $request->input('name_last');
        $allowedUpdating = $allowedName || $originalName === $newName;

        if (!$allowedUpdating) {
            return new JsonResponse(['errors' => ['name' => 'Updating your name is not allowed.']], Response::HTTP_BAD_REQUEST);
        }
        
        $this->updateService->handle($request->user(), $request->validated());

        Activity::event('user:account.profile-updated')->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's password. All existing sessions will be logged
     * out immediately.
     *
     * @throws \Throwable
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = Activity::event('user:account.password-changed')->transaction(function () use ($request) {
            return $this->updateService->handle($request->user(), $request->validated());
        });

        $guard = $this->manager->guard();
        // If you do not update the user in the session you'll end up working with a
        // cached copy of the user that does not include the updated password. Do this
        // to correctly store the new user details in the guard and allow the logout
        // other devices functionality to work.
        $guard->setUser($user);

        // This method doesn't exist in the stateless Sanctum world.
        if (method_exists($guard, 'logoutOtherDevices')) { // @phpstan-ignore function.alreadyNarrowedType
            $guard->logoutOtherDevices($request->input('password'));
        }

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Update the authenticated user's language preference.
     *
     * @throws \Throwable
     */
    public function updateLanguage(UpdateLanguageRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['language_set'] = true;

        $this->updateService->handle($request->user(), $data);

        Activity::event('user:account.language-changed')
            ->property('language', $request->input('language'))
            ->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }
}
