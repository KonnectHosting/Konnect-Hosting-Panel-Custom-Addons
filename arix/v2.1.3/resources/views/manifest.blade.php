{{-- PWA Manifest --}}
{
    "name": "{{ $siteConfiguration['arix']['meta']['title'] ?? 'Pterodactyl Panel' }}",
    "short_name": "Pterodactyl",
    "description": "{{ $siteConfiguration['arix']['meta']['description'] ?? 'Game server management panel' }}",
    "start_url": "/",
    "display": "standalone",
    "background_color": "{{ $siteConfiguration['arix']['meta']['color'] ?? '#0e0e1a' }}",
    "theme_color": "{{ $siteConfiguration['arix']['meta']['color'] ?? '#0e0e1a' }}",
    "orientation": "portrait-primary",
    "icons": [
        {
            "src": "{{ $siteConfiguration['arix']['meta']['favicon'] ?? '/favicons/android-chrome-192x192.png' }}",
            "sizes": "192x192",
            "type": "image/png"
        }
    ]
}