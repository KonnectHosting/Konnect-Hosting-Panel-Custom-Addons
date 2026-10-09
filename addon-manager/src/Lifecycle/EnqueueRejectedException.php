<?php

declare(strict_types=1);

namespace AddonManager\Lifecycle;

use RuntimeException;

/** A known semantic rejection made before a new operation is persisted. */
final class EnqueueRejectedException extends RuntimeException
{
}
