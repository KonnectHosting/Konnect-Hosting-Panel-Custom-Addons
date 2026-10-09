<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\Server;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\GetServerRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetSubscriptionController extends ClientApiController
{
    private function settings(): array
    {
        $settings = app(SettingsRepositoryInterface::class);
        $endpoint = (string) $settings->get('settings::arix:advanced:subscription:endpoint', '');

        return [
            'target' => strtolower((string) $settings->get('settings::arix:advanced:subscription:target', 'paymenter')),
            'endpoint' => $endpoint !== '' ? rtrim($endpoint, '/') . '/' : '',
            'identifier' => (string) $settings->get('settings::arix:advanced:subscription:identifier', ''),
            'secret' => (string) $settings->get('settings::arix:advanced:subscription:secret', ''),
        ];
    }

    private const WHMCS_CACHE_TTL_SECONDS = 3600;
	
    /**
     * Fetch subscription data for a server from an external provider endpoint.
	 */
	public function __invoke(GetServerRequest $request, Server $server): array
	{
		$settings = $this->settings();

		if (empty($server->external_id)) {
			throw new BadRequestHttpException('This server does not have an external_id.');
		}

        if ($settings['endpoint'] === '') {
            throw new BadRequestHttpException('Subscription endpoint is not configured.');
        }

        if ($settings['target'] === 'fake') {
            return [
                'object' => 'subscription',
                'data' => [
                    'status' => 'Active',
                    'price' => [
                        'amount' => '9.99',
                        'currency' => '$',
                    ],
                    'expires_at' => '2024-12-31T23:59:59Z',
                    'product' => 'Iron Plan',
                    'serviceLink' => '/',
                    'invoice' => [
                        'pending' => false,
                        'id' => null,
                        'due_at' => null,
                        'amount' => '9.99',
                        'link' => null,
                    ]
                ],
            ];
        }

        if ($settings['target'] === 'paymenter') {
            $response = Http::acceptJson()
                ->timeout(10)
                ->withToken($settings['secret'])
                ->get($settings['endpoint'] . 'api/v1/admin/services/' . $server->external_id . '?include=invoices,product');
            
            if($response->json('message')) {
                throw new BadRequestHttpException($response->json('message'));
            }

            if (!$response->successful()) {
                throw new HttpException(502, 'Paymenter subscription endpoint returned an error: ' . $response->body());
            }

            $included = collect($response->json('included', []));

            $product = $included->firstWhere('type', 'products');

            $unpaidInvoice = $included->first(function ($item) {
                return isset($item['type'], $item['attributes']['status'])
                    && $item['type'] === 'invoices'
                    && $item['attributes']['status'] !== 'paid';
            });

            return [
                'object' => 'subscription',
                'data' => [
                    'status' => $response->json('data.attributes.status'),
                    'price' => [
                        'amount' => $response->json('data.attributes.price'),
                        'currency' => $response->json('data.attributes.currency_code'),
                    ],
                    'expires_at' => $response->json('data.attributes.expires_at'),
                    'product' => $product['attributes']['name'] ?? null,
                    'serviceLink' => $settings['endpoint'] . 'services/' . $server->external_id,
                    'invoice' => [
                        'pending' => $unpaidInvoice ? $unpaidInvoice['attributes']['status'] === 'pending' : false,
                        'id' => $unpaidInvoice['id'] ?? null,
                        'due_at' => $unpaidInvoice['attributes']['due_at'] ?? null,
                        'amount' => $response->json('data.attributes.price'),
                        'link' => $unpaidInvoice ? $settings['endpoint'] . 'invoices/' . $unpaidInvoice['id'] : null,
                    ]
                ],
            ];
        }

        if ($settings['target'] === 'whmcs') {
            if ($settings['identifier'] === '' || $settings['secret'] === '') {
                throw new BadRequestHttpException('WHMCS identifier or secret is not configured.');
            }

            $productPayload = $this->whmcsRequest([
                'action' => 'GetClientsProducts',
                'serviceid' => (string) $server->external_id,
            ], $settings);

            if(($productPayload['result'] ?? null) !== 'success' || empty(data_get($productPayload, 'products.product.0'))) {
                throw new BadRequestHttpException('WHMCS subscription lookup failed: ' . json_encode($productPayload));
            }

            $invoicesPayload = $this->whmcsRequest([
                'action' => 'GetInvoices',
                'clientid' => (string) data_get($productPayload, 'products.product.0.clientid'),
                'status' => 'Unpaid',
            ], $settings);

            $invoiceCollection = $invoicesPayload['invoices']['invoice'] ?? ($invoicesPayload['invoiceid'] ?? null ? [$invoicesPayload] : []);

            if (!is_array($invoiceCollection)) {
                $invoiceCollection = [];
            }

            if (!empty($invoiceCollection) && array_keys($invoiceCollection) !== range(0, count($invoiceCollection) - 1)) {
                $invoiceCollection = [$invoiceCollection];
            }

            $matchedInvoice = null;
            foreach ($invoiceCollection as $invoice) {
                $invoiceId = $invoice['id'] ?? $invoice['invoiceid'] ?? null;
                if ($invoiceId === null) {
                    continue;
                }

                $invoiceDetails = $this->whmcsRequest([
                    'action' => 'GetInvoice',
                    'invoiceid' => (string) $invoiceId,
                ], $settings);

                $items = $invoiceDetails['items']['item'] ?? [];

                if (!is_array($items)) {
                    $items = [];
                }

                // Normalize invoice items to a list for consistent matching.
                if (!empty($items) && array_keys($items) !== range(0, count($items) - 1)) {
                    $items = [$items];
                }

                foreach ($items as $item) {
                    $relationId = $item['relid'] ?? null;
                    if ((string) $relationId === (string) $server->external_id) {
                        $matchedInvoice = $invoiceDetails;
                        break 2;
                    }
                }
            }

            return [
                'object' => 'subscription',
                'data' => [
                    'status' => data_get($productPayload, 'products.product.0.status'),
                    'price' => [
                        'amount' => data_get($productPayload, 'products.product.0.recurringamount'),
                        'currency' => null,
                    ],
                    'expires_at' => data_get($productPayload, 'products.product.0.nextduedate'),
                    'product' => data_get($productPayload, 'products.product.0.name'),
                    'serviceLink' => $settings['endpoint'] . 'clientarea.php?action=productdetails&id=' . $server->external_id,
                    'invoice' => [
                        'pending' => $matchedInvoice ? in_array(($matchedInvoice['status'] ?? null), ['Unpaid', 'Overdue'], true) : false,
                        'id' => $matchedInvoice['id'] ?? $matchedInvoice['invoiceid'] ?? null,
                        'due_at' => $matchedInvoice['duedate'] ?? null,
                        'amount' => $matchedInvoice['total'] ?? null,
                        'link' => $matchedInvoice ? $settings['endpoint'] . 'viewinvoice.php?id=' . ($matchedInvoice['id'] ?? $matchedInvoice['invoiceid']) : null,
                    ]
                ],
            ];
        }

        throw new BadRequestHttpException('Unsupported subscription target configured.');
	}

    private function whmcsRequest(array $query, array $settings): array
    {
        $requestQuery = array_merge([
            'identifier' => $settings['identifier'],
            'secret' => $settings['secret'],
            'responsetype' => 'json',
        ], $query);

        $cacheKey = sprintf(
            'subscription:whmcs:%s',
            hash('sha256', $settings['endpoint'] . ':' . json_encode($requestQuery))
        );

        return Cache::remember($cacheKey, self::WHMCS_CACHE_TTL_SECONDS, function () use ($requestQuery, $settings): array {
            $response = Http::acceptJson()
                ->timeout(10)
                ->get($settings['endpoint'] . 'includes/api.php', $requestQuery);

            if (!$response->successful()) {
                throw new HttpException(502, 'WHMCS request failed: ' . $response->body());
            }

            $payload = $response->json();
            if (!is_array($payload)) {
                throw new HttpException(502, 'WHMCS returned an invalid response payload.');
            }

            return $payload;
        });
    }
}
