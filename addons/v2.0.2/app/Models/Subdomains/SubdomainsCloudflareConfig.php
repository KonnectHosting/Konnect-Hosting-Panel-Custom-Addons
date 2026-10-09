<?php

namespace Pterodactyl\Models\Subdomains;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubdomainsCloudflareConfig extends Model
{
    use HasFactory;
    protected $fillable = ['email', 'api_key', 'proxy_records', 'use_alias', 'use_domain_alias'];
    protected $table = 'subdomains_cloudflare_config';
}
