<?php

namespace Pterodactyl\Models\Subdomains;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubdomainsConnectedDomains extends Model
{
    use HasFactory;
    protected $fillable = [
        'domain',
        'zone_id',
    ];
    protected $table = 'subdomains_connected_domains';
}
