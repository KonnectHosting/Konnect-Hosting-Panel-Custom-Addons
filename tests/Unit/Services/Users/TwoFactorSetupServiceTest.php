<?php

namespace Pterodactyl\Tests\Unit\Services\Users;

use PHPUnit\Framework\TestCase;
use Pterodactyl\Models\User;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Encryption\Encrypter;
use Pterodactyl\Services\Users\TwoFactorSetupService;
use Pterodactyl\Contracts\Repository\UserRepositoryInterface;

class TwoFactorSetupServiceTest extends TestCase
{
    #[\PHPUnit\Framework\Attributes\DataProvider('issuers')]
    public function testProvisioningUri(?string $issuer, string $expected): void
    {
        $config = new Repository([
            'app' => ['name' => 'Konnect Hosting'],
            'pterodactyl' => ['auth' => ['2fa' => ['issuer' => $issuer, 'bytes' => 32]]],
        ]);
        $user = new User();
        $user->forceFill(['id' => 123, 'email' => 'blake+panel@example.com', 'use_totp' => false]);
        $encrypter = $this->createMock(Encrypter::class);
        $repository = $this->createMock(UserRepositoryInterface::class);
        $secret = null;

        $encrypter->expects($this->once())->method('encrypt')
            ->willReturnCallback(function ($value) use (&$secret) {
                $secret = $value;

                return 'encrypted-secret';
            });
        $repository->expects($this->once())->method('withoutFreshModel')->willReturnSelf();
        $repository->expects($this->once())->method('update')
            ->with(123, ['totp_secret' => 'encrypted-secret']);

        $result = (new TwoFactorSetupService($config, $encrypter, $repository))->handle($user);

        $this->assertSame($secret, $result['secret']);
        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $result['secret']);
        $this->assertSame(
            'otpauth://totp/' . rawurlencode($expected) . ':blake%2Bpanel%40example.com?secret='
                . $result['secret'] . '&issuer=' . rawurlencode($expected),
            $result['image_url_data'],
        );
        $parts = parse_url($result['image_url_data']);
        parse_str($parts['query'], $query);
        $this->assertSame($expected, $query['issuer']);
        $this->assertSame($expected . ':' . $user->email, rawurldecode(substr($parts['path'], 1)));
        $this->assertSame($secret, $query['secret']);
        $this->assertSame('Konnect Hosting', $config->get('app.name'));
        $this->assertFalse($user->use_totp);
    }

    public static function issuers(): array
    {
        return [
            'dedicated panel issuer' => ['Konnect Hosting Panel', 'Konnect Hosting Panel'],
            'unset' => [null, 'Konnect Hosting'],
            'empty' => ['', 'Konnect Hosting'],
            'blank' => ['   ', 'Konnect Hosting'],
            'reserved and unicode' => ['Hébergement & Hosting + 100% / Panel?', 'Hébergement & Hosting + 100% / Panel?'],
            'literal percent escape' => ['Hosting%20Panel', 'Hosting%20Panel'],
        ];
    }
}
