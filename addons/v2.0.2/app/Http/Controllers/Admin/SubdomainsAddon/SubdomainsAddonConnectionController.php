<?php

namespace Pterodactyl\Http\Controllers\Admin\SubdomainsAddon;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Api\Client\SubdomainsAddon\DomainController;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Helpers\Cloudflare;
use Pterodactyl\Models\Subdomains\SubdomainsCloudflareConfig;
use Pterodactyl\Models\Subdomains\SubdomainsConnectedDomains;
use Pterodactyl\Models\Subdomains\SubdomainsUserSubdomain;

class SubdomainsAddonConnectionController extends Controller
{
    public function __construct(
        private SettingsRepositoryInterface $settings,
    )
    {
    }

    public function GetConnectedDomains(): JsonResponse
    {
        $connectedDomains = SubdomainsConnectedDomains::all();

        foreach ($connectedDomains as $connectedDomain) {
            $connectedDomain->serverCount = SubdomainsUserSubdomain::where('domain', $connectedDomain->domain)->count();
        }

        return response()->json($connectedDomains);
    }

    public function ConnectNewDomain(Request $request): JsonResponse
    {
        $domain = $request->input('domain');

        // get the newest credentials
        $config = SubdomainsCloudflareConfig::latest()->first();

        if (!$config) {
            return response()->json(['error' => 'No Cloudflare credentials found'], 422);
        }

        $cfRes = $this->listCloudflareZones($config);

        $zoneId = null;

        $rootDomain = $this->getRootDomain($domain, $config, $cfRes);

        foreach ($cfRes as $zone) {
            if ($zone['name'] == $rootDomain && $zone['status'] == 'active') {
                $zoneId = $zone['id'];
                break;
            }
        }
        if ($zoneId == null) {
            return response()->json(['error' => 'Domain not found in Cloudflare'], 404);
        }

        DB::beginTransaction();

        SubdomainsConnectedDomains::updateOrCreate([
            'domain' => $domain,
            'zone_id' => $zoneId,
        ]);

        DB::commit();

        return response()->json(['success' => 'Domain connected successfully']);
    }

    public function DisconnectDomain(string $domain): JsonResponse
    {
        DB::beginTransaction();

        $domains = SubdomainsUserSubdomain::where('domain', $domain)->get();

        $DomainController = new DomainController();
        foreach ($domains as $subdomain) {
            $delDomainError = $DomainController->DeleteDomainsFromServer($subdomain->server_id);
            if ($delDomainError) {
                DB::rollBack();
                return response()->json(['error' => $delDomainError], 422);
            }
        }

        SubdomainsConnectedDomains::where('domain', $domain)->delete();
        SubdomainsUserSubdomain::where('domain', $domain)->delete();

        DB::commit();

        return response()->json(['success' => 'Domain disconnected successfully']);
    }

    public function GetCloudflareConfig()
    {
        return response()->json(SubdomainsCloudflareConfig::latest()->first());
    }

    public function SetCloudflareKey(Request $request): JsonResponse
    {
        $existingKey = SubdomainsCloudflareConfig::latest()->first();

        $CloudFlareKey = $request->input('CloudFlareKey');
        $proxyRecords = $request->boolean('proxyRecords');
        $useAlias = $request->boolean('useAlias');
        $useDomainAlias = $request->boolean('useDomainAlias');

        $newKey = (object)[
            'api_key' => $CloudFlareKey,
        ];

        if ($existingKey) {
            $checked = $this->CheckDomainsForNewCloudflareKey($newKey);

            if (gettype($checked) == 'object') {
                return $checked;
            }

            if (count($checked['domainsNotFound']) > 0) {
                foreach ($checked['domainsNotFound'] as $domain) {
                    SubdomainsConnectedDomains::where('domain', $domain)->update(['status' => 'error']);
                }
            }

            if (count($checked['domainsWithClearedError']) > 0) {
                foreach ($checked['domainsWithClearedError'] as $domain) {
                    SubdomainsConnectedDomains::where('domain', $domain)->update(['status' => 'active']);
                }
            }
        }

        // clear all previous keys
        SubdomainsCloudflareConfig::truncate();

        SubdomainsCloudflareConfig::create([
            'api_key' => $CloudFlareKey,
            'proxy_records' => $proxyRecords,
            'use_alias' => $useAlias,
            'use_domain_alias' => $useDomainAlias,
        ]);

        return response()->json(['success' => 'Cloudflare key set successfully']);
    }

    public function SetCloudflareText(Request $request): JsonResponse
    {
        $text = $request->input('text');

        $this->settings->set('subdomains::cloudflare_custom_text', $text);

        return response()->json(['success' => 'Custom Cloudflare text set successfully']);
    }

    public function domainIsSubdomain($domain): bool
    {
        $domain = explode('.', $domain);
        return count($domain) > 2;
    }

    public function ForceDeleteSubdomainFromServer(Request $request, $server): JsonResponse
    {
        $DomainController = new DomainController();
        $DomainController->DeleteUserSubdomain($request->subdomain_id);

        // if the other function returns an error, just continue with the deletion of the subdomain from the server.
        // This may leave it in Cloudflare, but it'll be removed from the database.
        SubdomainsUserSubdomain::where('id', $request->subdomain_id)->delete();

        return response()->json(['success' => 'Subdomain deleted from server.']);
    }

    private function listCloudflareZones(object $config): array
    {
        $zones = [];
        $totalPages = 1; // Initialize with 1 to ensure the loop runs at least once, we'll update it later

        for ($page = 1; $page <= $totalPages; $page++) {
            $response = Cloudflare::DoAuthenticatedCloudflareCall(
                $config->api_key,
                "client/v4/zones?per_page=50&page={$page}"
            );

            if ($response->failed() || $response->status() != 200) {
                throw new DisplayException('Error fetching Cloudflare zones: ' . $response->body());
            }

            $responseData = $response->json();
            $zones = array_merge($zones, $responseData['result']);
            $totalPages = $responseData['result_info']['total_pages']; // Update total pages
        }

        return $zones;
    }

    private function CheckforCloudflareErrors(\GuzzleHttp\Promise\PromiseInterface|\Illuminate\Http\Client\Response $cfRes): bool|JsonResponse
    {
        if ($cfRes->failed()) {
            return response()->json(['error' => 'Error: ' . $cfRes->body()]);
        }
        if ($cfRes->status() != 200) {
            return response()->json(['error' => 'Error: ' . $cfRes->body()]);
        }

        return false;
    }

    private function CheckDomainsForNewCloudflareKey(object $newKey): array|JsonResponse
    {
        $cfRes = $this->listCloudflareZones($newKey);

        $connectedDomains = SubdomainsConnectedDomains::all();

        $domainsFound = [];
        $domainsNotFound = [];
        $domainsWithClearedError = [];
        // check if the connected domains are all still available
        foreach ($connectedDomains as $connectedDomain) {
            foreach ($cfRes as $zone) {
                if ($zone['id'] == $connectedDomain->zone_id && $zone['status'] == 'active') {
                    $domainsFound[] = $zone['name'];
                    break;
                }
            }


            // check if domains with an error status are found in the cloudflare zones
            $connectedDomainsWithError = SubdomainsConnectedDomains::where('status', 'error')->get();
            foreach ($connectedDomainsWithError as $connectedDomain) {
                foreach ($domainsFound as $domain) {
                    if ($connectedDomain->domain == $domain) {
                        $domainsWithClearedError[] = $domain;
                    }
                }
            }
        }

        // find the domains that are in the database but not in the cloudflare zones
        foreach ($connectedDomains as $connectedDomain) {
            if (!in_array($connectedDomain->domain, $domainsFound)) {
                $domainsNotFound[] = $connectedDomain->domain;
            }
        }

        return ['domainsWithClearedError' => $domainsWithClearedError, 'domainsNotFound' => $domainsNotFound];
    }

    private function getRootDomain(string $domain, object $config, $zones): string
    {
        $domainParts = explode('.', $domain);
        for ($i = 0; $i < count($domainParts) - 1; $i++) {
            $potentialRoot = implode('.', array_slice($domainParts, $i));
            foreach ($zones as $zone) {
                if ($zone['name'] === $potentialRoot) {
                    return $potentialRoot;
                }
            }
        }

        // Fallback to the last two parts if no match is found
        return $domainParts[count($domainParts) - 2] . '.' . $domainParts[count($domainParts) - 1];
    }
}