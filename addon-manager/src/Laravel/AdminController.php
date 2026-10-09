<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use AddonManager\Lifecycle\EnqueueRejectedException;
use AddonManager\Lifecycle\Manager;
use RuntimeException;

final class AdminController extends Controller
{
    public function __construct(private readonly Manager $manager, private readonly HostAdapter $host)
    {
    }

    public function index(): mixed
    {
        return view('addon-manager::index', ['apiBase' => url('/admin/addon-manager/api'), 'assetBase' => asset('addon-manager/build')]);
    }

    public function listing(): mixed
    {
        return response()->json(['data' => $this->manager->listing()]);
    }

    public function enqueue(Request $request): mixed
    {
        $actor = (string) $request->user()->getAuthIdentifier();
        if ($request->header('X-Addon-Manager-Actor') !== $actor) {
            abort(403, 'Your administrator session changed. Refresh the manager page before retrying.');
        }
        $unknown = array_diff(array_keys($request->all()), ['action', 'url', 'addonId', 'cascade', 'expectedAffectedIds', 'requestId']);
        if ($unknown !== []) {
            throw ValidationException::withMessages(['request' => ['Unknown fields: ' . implode(', ', $unknown)]]);
        }
        $validated = $request->validate([
            'action' => ['required', 'in:install,update,enable,disable,delete'],
            'url' => ['nullable', 'string', 'max:2048'],
            'addonId' => ['nullable', 'string', 'regex:/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/D', 'max:128'],
            'cascade' => ['sometimes', 'boolean'],
            'expectedAffectedIds' => ['sometimes', 'array', 'max:1000'],
            'expectedAffectedIds.*' => ['required', 'string', 'distinct', 'regex:/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/D', 'max:128'],
            'requestId' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{16,128}$/D'],
        ]);
        $action = $validated['action'];
        if (in_array($action, ['install', 'update'], true) && empty($validated['url'])) {
            throw ValidationException::withMessages(['url' => ['A public GitHub package URL is required.']]);
        }
        if ($action !== 'install' && empty($validated['addonId'])) {
            throw ValidationException::withMessages(['addonId' => ['An addon ID is required.']]);
        }
        if (isset($validated['expectedAffectedIds']) && !in_array($action, ['disable', 'delete'], true)) {
            throw ValidationException::withMessages(['expectedAffectedIds' => ['Affected addon confirmation applies to disable or delete.']]);
        }
        $arguments = array_intersect_key($validated, array_flip(['url', 'addonId', 'cascade', 'expectedAffectedIds']));
        try {
            $operation = $this->manager->enqueue($action, $arguments, 'admin:' . $actor, $validated['requestId']);
        } catch (EnqueueRejectedException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json(['data' => $operation], 202);
    }

    public function operation(string $id): mixed
    {
        if (!preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $id)) {
            abort(404);
        }
        try {
            return response()->json(['data' => $this->manager->operation($id)]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 404);
        }
    }

    public function doctor(): mixed
    {
        return response()->json(['data' => ['manager' => $this->manager->doctor(), 'host' => $this->host->doctor()]]);
    }
}
