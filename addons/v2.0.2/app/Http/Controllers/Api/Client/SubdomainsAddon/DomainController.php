<?php

namespace Pterodactyl\Http\Controllers\Api\Client\SubdomainsAddon;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Promise\Utils;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\File;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

use Pterodactyl\Helpers\Cloudflare;
use Pterodactyl\Http\Requests\Api\Client\Servers\GetServerRequest;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Subdomains\SubdomainsCloudflareConfig;
use Pterodactyl\Models\Subdomains\SubdomainsConnectedDomains;
use Pterodactyl\Models\Subdomains\SubdomainBlocklist;
use Pterodactyl\Models\Subdomains\SubdomainsUserSubdomain;
use Pterodactyl\Models\Server;

class DomainController extends Controller
{
    public function Index(): Jsonresponse
    {
        $config = SubdomainsCloudflareConfig::latest()->first();
        if ($config == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Cloudflare not configured",
            ]);
        }

        $domains = SubdomainsConnectedDomains::where(
            "status",
            "=",
            "active",
        )->get();

        return new JsonResponse([
            "status" => "success",
            "data" => $domains->pluck("domain"),
        ]);
    }

    public function getSubdomainsForServer(
        GetServerRequest $request,
        Server $server,
    ): Jsonresponse {
        $request = Request();

        if (
            !$request->user()->can(Permission::ACTION_ALLOCATION_READ, $server)
        ) {
            throw new AuthorizationException();
        }

        $subdomains = SubdomainsUserSubdomain::where(
            "server_id",
            $server->id,
        )->get();

        $config = SubdomainsCloudflareConfig::latest()->first();

        $subdomainsWithPort = $subdomains->mapWithKeys(function ($domain) use (
            $server,
            $config,
        ) {
            $allocation = $server
                ->allocations()
                ->where("id", $domain->port_id)
                ->first();

            // ip changed or allocation deleted so delete the subdomain
            if ($allocation == null) {
                $this->DeleteUserSubdomain($domain->id);
                return [];
            }

            $ipToUse =
                $config->use_alias || $config->use_domain_alias
                    ? $allocation->ip_alias
                    : $allocation->ip;
            return [
                $domain->id => [
                    "full_domain" => $domain->full_domain,
                    "ip" => $ipToUse,
                    "port" => $allocation->port,
                ],
            ];
        });

        return new JsonResponse([
            "status" => "success",
            "data" => $subdomainsWithPort,
        ]);
    }

    public function createSubDomainForServer(Server $server): Jsonresponse
    {
        $request = Request();

        if (
            !$request
                ->user()
                ->can(Permission::ACTION_ALLOCATION_CREATE, $server)
        ) {
            throw new AuthorizationException();
        }

        $domain = request()->input("domain");
        $subdomain = request()->input("subdomain");

        // Check if the domain and subdomain are provided
        $request->validate([
            "domain" => "required|string",
            "subdomain" => "required|string",
            "port_id" => "required|integer",
        ]);

        $subdomain = strtolower($subdomain);

        $fullDomain = $subdomain . "." . $domain;

        // check how many domains are already connected
        $connectedDomainsCount = SubdomainsUserSubdomain::where(
            "server_id",
            $server->id,
        )->count();
        if ($connectedDomainsCount >= $server->subdomain_limit) {
            return new JsonResponse([
                "status" => "error",
                "message" =>
                    "You have reached the maximum amount of subdomains for this server",
            ]);
        }

        // split the subdomain into parts
        $subdomainExploded = explode(".", $subdomain);

        $domainIsBlocked = SubdomainBlocklist::whereIn(
            "subdomain",
            $subdomainExploded,
        )->first();
        if ($domainIsBlocked != null) {
            $reasonText =
                $domainIsBlocked->reason != null
                    ? " Reason: " . $domainIsBlocked->reason
                    : "";

            return new JsonResponse([
                "status" => "error",
                "message" =>
                    "you're not allowed to create a subdomain containing the word '" .
                    $domainIsBlocked->subdomain .
                    "'. $reasonText ",
            ]);
        }

        $recordRules = $this->getSRVrecordRulesForNest($server->nest_id);
        if ($recordRules == null) {
            return new JsonResponse([
                "status" => "error",
                "message" =>
                    "Invalid nest id, it is possible that the game is not supported for subdomains",
            ]);
        }

        $config = SubdomainsCloudflareConfig::latest()->first();
        if ($config == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Cloudflare not configured",
            ]);
        }

        // convert proxy_records to boolean
        $config->proxy_records = $config->proxy_records >= 1;

        // Check if the domain is connected
        $connectedDomain = SubdomainsConnectedDomains::where(
            "domain",
            $domain,
        )->first();
        if ($connectedDomain == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Domain not connected",
            ]);
        }

        // Check if the subdomain already exists
        $subdomainRequested = SubdomainsUserSubdomain::where([
            ["full_domain", "like", "%" . $subdomain . "." . $domain],
            ["domain", $domain],
        ])->first();
        if ($subdomainRequested != null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Subdomain already exists",
            ]);
        }

        // check if the port's allocation belongs to the server
        $portId = $request->port_id;
        $port_allocation = $server
            ->allocations()
            ->where("id", $portId)
            ->first();
        if ($port_allocation == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Port not found",
            ]);
        }

        $ipToUse =
            $config->use_alias || $config->use_domain_alias
                ? $port_allocation->ip_alias
                : $port_allocation->ip;

        if ($ipToUse == null) {
            return new JsonResponse([
                "status" => "error",
                "message" =>
                    "IP" . ($config->use_alias ? " alias " : "") . "not found",
            ]);
        }

        if (!$config->use_domain_alias) {
            // Create the A record for the subdomain
            $response = $this->makeArecordForSubdomain(
                $config,
                $connectedDomain->zone_id,
                $fullDomain,
                $ipToUse,
            );
            if ($response->status() != 200) {
                return new JsonResponse([
                    "status" => "error",
                    "message" => "Failed to create A record",
                    "response" => $response->json(),
                ]);
            }
        }

        // the domain to use as the target for the SRV record
        $target = $config->use_domain_alias
            ? $port_allocation->ip_alias
            : $fullDomain;

        $response = $this->makeSRVrecordForSubdomain(
            $config,
            $connectedDomain->zone_id,
            $port_allocation->port,
            $fullDomain,
            $target,
            $recordRules,
        );
        if ($response->status() != 200) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Failed to create subdomain",
                "response" => $response->json(),
            ]);
        }

        $id = SubdomainsUserSubdomain::create([
            "subdomain" => $subdomain,
            "domain" => $domain,
            "full_domain" => $fullDomain,
            "nest_id" => $server->nest_id,
            "server_id" => $server->id,
            "port_id" => $portId,
        ])->id;

        return new JsonResponse([
            "status" => "success",
            "id" => $id,
        ]);
    }

    public function deleteSubdomainForServer(
        Server $server,
        string $domainId,
    ): JsonResponse {
        $request = Request();

        if (
            !$request
                ->user()
                ->can(Permission::ACTION_ALLOCATION_DELETE, $server)
        ) {
            throw new AuthorizationException();
        }

        if ($domainId == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Domain id not provided",
            ]);
        }

        if (!is_numeric($domainId)) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Domain id is not a number",
            ]);
        }

        return $this->DeleteUserSubdomain($domainId);
    }

    private function makeArecordForSubdomain(
        object $config,
        string $zoneId,
        string $domain,
        string $ip,
    ): PromiseInterface|Response {
        return Cloudflare::DoAuthenticatedCloudflareCall(
            $config->api_key,
            "client/v4/zones/" . $zoneId . "/dns_records",
            "POST",
            [
                "type" => "A",
                "name" => $domain,
                "content" => $ip,
                "comment" => "Created by Subdomains Addon",
                "ttl" => 1,
                "proxied" => $config->proxy_records,
            ],
        );
    }

    private function makeCNAMErecordForSubdomain(
        object $config,
        string $zoneId,
        string $domain,
        string $ip,
    ): PromiseInterface|Response {
        return Cloudflare::DoAuthenticatedCloudflareCall(
            $config->api_key,
            "client/v4/zones/" . $zoneId . "/dns_records",
            "POST",
            [
                "type" => "CNAME",
                "name" => $domain,
                "content" => $ip,
                "comment" => "Created by Subdomains Addon",
                "ttl" => 1,
                "proxied" => $config->proxy_records,
            ],
        );
    }

    private function makeSRVrecordForSubdomain(
        object $config,
        string $zoneId,
        int $serverPort,
        string $fullDomain,
        string $target,
        array $recordRules,
    ): PromiseInterface|Response {
        return Cloudflare::DoAuthenticatedCloudflareCall(
            $config->api_key,
            "client/v4/zones/" . $zoneId . "/dns_records",
            "POST",
            [
                "data" => [
                    "port" => $serverPort,
                    "priority" => 1,
                    "target" => $target,
                    "weight" => 5,
                    "ttl" => 1,
                    "proxied" => false,
                ],
                "type" => "SRV",
                "name" => $recordRules["prefix"] . $fullDomain,
                "comment" => "Created by Subdomains Addon",
                "ttl" => 1,
                "priority" => 0,
                "proxied" => false,
            ],
        );
    }

    private function listDNSRecordsForZone(
        object $config,
        string $zoneId,
    ): PromiseInterface|Response {
        return Cloudflare::DoAuthenticatedCloudflareCall(
            $config->api_key,
            "client/v4/zones/" . $zoneId . "/dns_records?per_page=5000000",
            "GET",
        );
    }

    public function deleteRecordFromCloudflare(
        object $config,
        string $zoneId,
        string $recordId,
    ): PromiseInterface|Response {
        return Cloudflare::DoAuthenticatedCloudflareCall(
            $config->api_key,
            "client/v4/zones/" . $zoneId . "/dns_records/" . $recordId,
            "DELETE",
        );
    }

    public function DeleteDomainsFromServer($serverId): bool|string
    {
        $subdomains = SubdomainsUserSubdomain::where(
            "server_id",
            $serverId,
        )->get();

        foreach ($subdomains as $subdomain) {
            $delDomain = $this->DeleteUserSubdomain($subdomain->id);
            $deletedDomain = json_decode($delDomain->getContent(), true);
            if ($deletedDomain["status"] != "success") {
                if (
                    $deletedDomain["message"] ==
                    "Subdomain not found in Cloudflare"
                ) {
                    continue;
                }

                return $delDomain["message"];
            }
        }

        return false;
    }

    public function DeleteUserSubdomain($domainId): JsonResponse
    {
        $config = SubdomainsCloudflareConfig::latest()->first();
        if ($config == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Cloudflare not configured",
            ]);
        }

        $subdomain = SubdomainsUserSubdomain::where("id", $domainId)->first();
        if ($subdomain == null) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Subdomain not found",
            ]);
        }

        $nestId = Server::where("id", $subdomain->server_id)->first()->nest_id;

        $recordRules = $this->getSRVrecordRulesForNest($nestId);
        if ($recordRules == null) {
            return new JsonResponse([
                "status" => "error",
                "message" =>
                    "Invalid nest id, it is possible that the game is not supported for subdomains",
            ]);
        }

        $zoneId = SubdomainsConnectedDomains::select("zone_id")
            ->where("domain", $subdomain->domain)
            ->first()->zone_id;
        $cfDomains = $this->listDNSRecordsForZone($config, $zoneId);
        if ($cfDomains->status() != 200) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Failed to list DNS records",
                "response" => $cfDomains->json(),
            ]);
        }

        $cfDomains = $cfDomains->json();

        $subdomainCf = collect($cfDomains["result"])
            ->filter(function ($value) use ($subdomain) {
                return $value["name"] == $subdomain->full_domain;
            })
            ->first();

        $subdomainSRV = collect($cfDomains["result"])
            ->filter(function ($value) use ($subdomain, $recordRules) {
                return $value["name"] ==
                    $recordRules["prefix"] . $subdomain->full_domain;
            })
            ->first();

        if (
            ($subdomainCf == null && !$config->use_domain_alias) ||
            $subdomainSRV == null
        ) {
            return new JsonResponse([
                "status" => "error",
                "message" => "Subdomain not found in Cloudflare",
            ]);
        }

        $subdomainIdCf = $subdomainCf["id"] ?? null;
        $subdomainIdSRV = $subdomainSRV["id"];

        $promises = [];
        // Add the deletion requests to the promises array
        if (!$config->use_domain_alias) {
            $promises[] = $this->deleteRecordFromCloudflare(
                $config,
                $zoneId,
                $subdomainIdCf,
            );
        }
        $promises[] = $this->deleteRecordFromCloudflare(
            $config,
            $zoneId,
            $subdomainIdSRV,
        );

        // Wait for all promises to complete
        $responses = Utils::all($promises)->wait();

        // Check the results of each promise
        foreach ($responses as $response) {
            if ($response->status() != 200) {
                return new JsonResponse([
                    "status" => "error",
                    "message" => "Failed to delete record",
                    "response" => $response->json(),
                ]);
            }
        }

        $subdomain->delete();

        return new JsonResponse([
            "status" => "success",
            "message" => "Subdomain deleted",
        ]);
    }

    public function getSRVrecordRulesForNest($nest_id)
    {
        $file = File::get(base_path("subdomains_addon_SRV_nest_rules.json"));
        $json = json_decode(json: $file, associative: true);

        if (!array_key_exists($nest_id, $json)) {
            return null;
        }

        return $json[$nest_id];
    }
}
