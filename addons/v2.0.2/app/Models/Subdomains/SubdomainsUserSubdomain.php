<?php

namespace Pterodactyl\Models\Subdomains;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubdomainsUserSubdomain extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'subdomain',
        'domain',
        'full_domain',
        'nest_id',
        'server_id',
        'port_id'
    ];
    protected $table = 'subdomains_user_subdomains';
}
