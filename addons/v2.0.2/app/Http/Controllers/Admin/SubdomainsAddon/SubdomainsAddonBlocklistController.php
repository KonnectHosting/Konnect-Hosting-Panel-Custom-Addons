<?php

namespace Pterodactyl\Http\Controllers\Admin\SubdomainsAddon;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Pterodactyl\Models\Subdomains\SubdomainBlocklist;

class SubdomainsAddonBlocklistController  {
    public function index(): JsonResponse {
        $subdomain = SubdomainBlocklist::all();

        return response()->json($subdomain);
    }

    public function AddBlocklist() : JsonResponse {
        if (empty(request()->input('word'))) {
            return response()->json(['error' => 'Please enter a subdomain to block.'], 422);
        }

        $word = strtolower(request()->input('word'));

        if (SubdomainBlocklist::where('subdomain', $word)->first()) {
            return response()->json(['error' => 'This word is already blocked.'], 409);
        }

        $subdomain = new SubdomainBlocklist();
        $subdomain->subdomain = $word;
        $subdomain->reason = request()->input('reason');
        $subdomain->save();

        return response()->json(['success' => 'Subdomain added to blocklist.']);
    }

    public function RemoveBlocklist($id): JsonResponse {
        if (empty($id)) {
            $id = request()->input('id');

            if ($id == null){
                return response()->json(['error' => 'Please enter a subdomain to remove.'], 422);
            }
        }
        $subdomain = SubdomainBlocklist::findOrFail($id);
        $subdomain->delete();

        return response()->json(['success' => 'Subdomain removed from blocklist.']);
    }

    public function ExportBlocklist(): BinaryFileResponse {
        $blocklist = SubdomainBlocklist::all()->toArray();
        $json = json_encode($blocklist, JSON_PRETTY_PRINT);
        $filename = 'blocklist.json';
        file_put_contents($filename, $json);

        return response()->download($filename)->deleteFileAfterSend();
    }

    public function ImportBlocklist(): JsonResponse {
        if (request()->hasFile('blocklist') && request()->file('blocklist')->isValid()) {
            $data = json_decode(file_get_contents(request()->file('blocklist')->getRealPath()), true);
        } else {
            $data = request()->input('blocklist', request()->all());
        }

        if (!is_array($data)) {
            return response()->json(['error' => 'Please provide a JSON blocklist to import.'], 422);
        }

        $currentBlocklist = SubdomainBlocklist::all()->pluck('subdomain')->toArray();

        foreach ($data as $item) {
            if (!is_array($item) || !isset($item['subdomain'])) {
                return response()->json(['error' => 'Each blocklist item must include a subdomain.'], 422);
            }

            if (in_array($item['subdomain'], $currentBlocklist)) {
                continue;
            }

            $subdomain = new SubdomainBlocklist();
            $subdomain->subdomain = $item['subdomain'];
            $subdomain->reason = $item['reason'] ?? null;
            $subdomain->save();
        }

        return response()->json(['success' => 'Blocklist imported successfully.']);
    }
}
