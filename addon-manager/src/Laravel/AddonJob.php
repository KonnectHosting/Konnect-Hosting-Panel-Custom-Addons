<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Only this manager-owned type is serialized. It never contains an addon object. */
final class AddonJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $timeout = 60;

    public function __construct(
        public readonly string $addonId,
        public readonly string $addonVersion,
        public readonly string $jobId,
        public readonly array $payload = [],
    ) {
        ExtensionRegistry::assertJobPayload($payload);
    }

    public function handle(ExtensionRegistry $extensions): mixed
    {
        if ($extensions->maintenance()) {
            $this->release(15);
            return null;
        }
        return $extensions->runJob($this->addonId, $this->addonVersion, $this->jobId, $this->payload);
    }
}
