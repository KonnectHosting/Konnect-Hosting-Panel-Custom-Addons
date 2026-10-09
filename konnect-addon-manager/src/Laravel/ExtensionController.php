<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Laravel;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class ExtensionController extends Controller
{
    public function __construct(private readonly ExtensionRegistry $extensions)
    {
    }

    public function dispatch(Request $request): mixed
    {
        return $this->extensions->dispatch($request);
    }
}
