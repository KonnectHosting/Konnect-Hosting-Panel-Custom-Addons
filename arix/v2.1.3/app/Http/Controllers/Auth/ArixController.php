<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Support\Facades\Http;

class ArixController extends AbstractLoginController
{
    public function index(): object
    {

        $endpoint = 'https://arix.gg/internal/check';
    
        $response = Http::asForm()->post($endpoint, [
            'license' => 'ARIX-CHECK',
        ]);
    
        $responseData = $response->json();
    
        if (!$responseData['success']) {
            return response()->json([
                'status' => 'Not available'
            ]);
        }

        return response()->json([
            'NONCE' => '1a650079277776d7b60f9b92bd883c63',
            'ID' => '203934',
            'USERNAME' => 'BadWorksFun',
            'TIMESTAMP' => '1791555475'
        ]);
    }
}