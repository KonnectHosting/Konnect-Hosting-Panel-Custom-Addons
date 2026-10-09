<!DOCTYPE html>
<html>
    <head>
        <title>{{ config('app.name', 'Pterodactyl') }}</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            
            <!-- meta data -->
            @if(!$siteConfiguration['arix']['meta']['index'])
                <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
            @endif
            <meta name="theme-color" content="{{ $siteConfiguration['arix']['meta']['color'] }}"/>
            <link rel="icon" type="image/x-icon" href="{{ $siteConfiguration['arix']['meta']['favicon'] }}">

            <meta name="title" content="{{ $siteConfiguration['arix']['meta']['title'] }}" />
            <meta name="description" content="{{ $siteConfiguration['arix']['meta']['description'] }}" />

            <meta property="og:type" content="website" />
            <meta property="og:url" content="{{config('app.url', 'https://localhost')}}" />
            <meta property="og:title" content="{{ $siteConfiguration['arix']['meta']['title'] }}" />
            <meta property="og:description" content="{{ $siteConfiguration['arix']['meta']['description'] }}" />
            <meta property="og:image" content="{{ $siteConfiguration['arix']['meta']['image'] }}" />

            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content="{{config('app.url', 'https://localhost')}}" />
            <meta property="twitter:title" content="{{ $siteConfiguration['arix']['meta']['title'] }}" />
            <meta property="twitter:description" content="{{ $siteConfiguration['arix']['meta']['description'] }}" />
            <meta property="twitter:image" content="{{ $siteConfiguration['arix']['meta']['image'] }}" />

            <!-- PWA -->
            <link rel="manifest" href="/manifest.json">
            <meta name="apple-mobile-web-app-capable" content="yes">
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
            <meta name="apple-mobile-web-app-title" content="{{ config('app.name', 'Pterodactyl') }}">
            <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png">

            <!-- meta data -->
            <!--
            <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=203934">
            <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
            <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
            <link rel="manifest" href="/favicons/manifest.json">
            <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
            <link rel="shortcut icon" href="/favicons/favicon.ico">
            <meta name="msapplication-config" content="/favicons/browserconfig.xml">
        -->
        @show

        @section('user-data')
            @if(!is_null(Auth::user()))
                <script>
                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};
                </script>
            @endif
            @if(!empty($siteConfiguration))
                <script>
                    window.SiteConfiguration = {!! json_encode(\Illuminate\Support\Arr::except($siteConfiguration, ['arix.mail.developerCode', 'arix.mail.editorCode'])) !!};
                </script>
            @endif
            @php
                $authUser = Auth::user();
                $adminPreviewToken = null;

                if ($authUser && (bool) data_get($authUser, 'root_admin')) {
                    $adminPreviewToken = session('arix_admin_preview_token');

                    if (!is_string($adminPreviewToken) || strlen($adminPreviewToken) < 64) {
                        $adminPreviewToken = bin2hex(random_bytes(32));
                        session(['arix_admin_preview_token' => $adminPreviewToken]);
                    }
                }

                $adminPreviewQueryValue = request()->query('admin-preview');
                $adminPreviewQuery = request()->query();
                $canEnableAdminPreview =
                    $authUser
                    && (bool) data_get($authUser, 'root_admin')
                    && is_string($adminPreviewToken)
                    && is_string($adminPreviewQueryValue)
                    && count($adminPreviewQuery) === 1
                    && hash_equals($adminPreviewToken, $adminPreviewQueryValue);
            @endphp
            @if($canEnableAdminPreview)
                <script>
                    window.AdminPreview = true;
                </script>
            @endif
            @if(is_string($adminPreviewToken))
                <script>
                    window.AdminPreviewToken = @json($adminPreviewToken);
                </script>
            @endif
        @show
        <style>
            .animationsDisabled * {
                animation-duration: 0.001ms !important;
                animation-delay: 0s !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.001ms !important;
                transition-delay: 0s !important;
                transition: none !important;
            }

            @import url('{{
                    [
                        'poppins' => '//fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
                        'dm_sans' => '//fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap',
                        'roboto' => '//fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
                        'sciencegothic' => '//fonts.googleapis.com/css2?family=Science+Gothic:wght@300;400;500;700&display=swap',
                        'inter' => '//fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
                        'montserrat' => '//fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
                        'open_sans' => '//fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap',
                        'lato' => '//fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
                        'nunito' => '//fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap',
                        'oswald' => '//fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;700&display=swap',
                        'playfair' => '//fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
                        'source_sans' => '//fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap',
                        'quicksand' => '//fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;700&display=swap',
                        'manrope' => '//fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap',
                        'space_grotesk' => '//fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
                    ][$siteConfiguration['arix']['styling']['font']] ?? ''
                }}');
                
            @import url('//fonts.googleapis.com/css?family=Rubik:300,400,500&display=swap');
            @import url('//fonts.googleapis.com/css?family=IBM+Plex+Mono|IBM+Plex+Sans:500&display=swap');
            
            :root{
                --fontFamily: {{
                    [
                    'poppins' => 'Poppins, sans-serif',
                    'dm_sans' => 'DM Sans, sans-serif',
                    'roboto' => 'Roboto, sans-serif',
                    'sciencegothic' => 'Science Gothic, sans-serif',
                    'inter' => 'Inter, sans-serif',
                    'montserrat' => 'Montserrat, sans-serif',
                    'open_sans' => 'Open Sans, sans-serif',
                    'lato' => 'Lato, sans-serif',
                    'nunito' => 'Nunito, sans-serif',
                    'oswald' => 'Oswald, sans-serif',
                    'playfair' => 'Playfair Display, sans-serif',
                    'source_sans' => 'Source Sans Pro, sans-serif',
                    'quicksand' => 'Quicksand, sans-serif',
                    'manrope' => 'Manrope, sans-serif',
                    'space_grotesk' => 'Space Grotesk, sans-serif',
                ][$siteConfiguration['arix']['styling']['font']] ?? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif'
                }};
            }

            <?php if ($siteConfiguration['arix']['advanced']['defaultMode'] === 'darkmode') {
                echo ':root';
            } else {
                echo '.lightmode';
            }?>{
                --primary: {{ $siteConfiguration['arix']['colors']['dark']['primary'] }};

                --successText: {{ $siteConfiguration['arix']['colors']['dark']['successText'] }};
                --successBorder: {{ $siteConfiguration['arix']['colors']['dark']['successBorder'] }};
                --successBackground: {{ $siteConfiguration['arix']['colors']['dark']['successBackground'] }};

                --dangerText: {{ $siteConfiguration['arix']['colors']['dark']['dangerText'] }};
                --dangerBorder: {{ $siteConfiguration['arix']['colors']['dark']['dangerBorder'] }};
                --dangerBackground: {{ $siteConfiguration['arix']['colors']['dark']['dangerBackground'] }}; 

                --secondaryText: {{ $siteConfiguration['arix']['colors']['dark']['secondaryText'] }};
                --secondaryBorder: {{ $siteConfiguration['arix']['colors']['dark']['secondaryBorder'] }};
                --secondaryBackground: {{ $siteConfiguration['arix']['colors']['dark']['secondaryBackground'] }};

                --gray50: {{ $siteConfiguration['arix']['colors']['dark']['gray50'] }};
                --gray100: {{ $siteConfiguration['arix']['colors']['dark']['gray100'] }};
                --gray200: {{ $siteConfiguration['arix']['colors']['dark']['gray200'] }};
                --gray300: {{ $siteConfiguration['arix']['colors']['dark']['gray300'] }};
                --gray400: {{ $siteConfiguration['arix']['colors']['dark']['gray400'] }};
                --gray500: {{ $siteConfiguration['arix']['colors']['dark']['gray500'] }};
                --gray600: {{ $siteConfiguration['arix']['colors']['dark']['gray600'] }};
                --gray700: color-mix(in srgb, rgb({{ $siteConfiguration['arix']['colors']['dark']['gray700'] }}) var(--backdropPercentage), transparent);
                --gray800: {{ $siteConfiguration['arix']['colors']['dark']['gray800'] }};
                --gray900: {{ $siteConfiguration['arix']['colors']['dark']['gray900'] }};

                --gray700-default: {{ $siteConfiguration['arix']['colors']['dark']['gray700'] }};
                --fallBackGray: color-mix(in srgb, rgb({{ $siteConfiguration['arix']['colors']['dark']['gray700'] }}) var(--backdropPercentage), transparent);
            }
            <?php if ($siteConfiguration['arix']['advanced']['defaultMode'] !== 'darkmode') {
                echo ':root';
            } else {
                echo '.lightmode';
            }?>{
                --primary: {{ $siteConfiguration['arix']['colors']['light']['primary'] }};

                --successText: {{ $siteConfiguration['arix']['colors']['light']['successText'] }};
                --successBorder: {{ $siteConfiguration['arix']['colors']['light']['successBorder'] }};
                --successBackground: {{ $siteConfiguration['arix']['colors']['light']['successBackground'] }};

                --dangerText: {{ $siteConfiguration['arix']['colors']['light']['dangerText'] }};
                --dangerBorder: {{ $siteConfiguration['arix']['colors']['light']['dangerBorder'] }};
                --dangerBackground: {{ $siteConfiguration['arix']['colors']['light']['dangerBackground'] }}; 

                --secondaryText: {{ $siteConfiguration['arix']['colors']['light']['secondaryText'] }};
                --secondaryBorder: {{ $siteConfiguration['arix']['colors']['light']['secondaryBorder'] }};
                --secondaryBackground: {{ $siteConfiguration['arix']['colors']['light']['secondaryBackground'] }};

                --gray50: {{ $siteConfiguration['arix']['colors']['light']['gray50'] }};
                --gray100: {{ $siteConfiguration['arix']['colors']['light']['gray100'] }};
                --gray200: {{ $siteConfiguration['arix']['colors']['light']['gray200'] }};
                --gray300: {{ $siteConfiguration['arix']['colors']['light']['gray300'] }};
                --gray400: {{ $siteConfiguration['arix']['colors']['light']['gray400'] }};
                --gray500: {{ $siteConfiguration['arix']['colors']['light']['gray500'] }};
                --gray600: {{ $siteConfiguration['arix']['colors']['light']['gray600'] }}; 
                --gray700: color-mix(in srgb, rgb({{ $siteConfiguration['arix']['colors']['light']['gray700'] }}) var(--backdropPercentage), transparent);
                --gray800: {{ $siteConfiguration['arix']['colors']['light']['gray800'] }};
                --gray900: {{ $siteConfiguration['arix']['colors']['light']['gray900'] }};

                --gray700-default: {{ $siteConfiguration['arix']['colors']['light']['gray700'] }};
            }

            .oled {
                --gray700: color-mix(in srgb, 0 0 0 100%, transparent);
                --gray800: 0 0 0;
                --gray900: 0 0 0;

                --gray700-default: 0 0 0;
            }
        </style>

        @yield('assets')

        @include('layouts.scripts')
    </head>
    <body class="{{ $css['body'] ?? 'bg-neutral-50' }}">
        @section('content')
            @yield('above-container')
            @yield('container')
            @yield('below-container')
        @show
        @section('scripts')
            {!! $asset->js('main.js') !!}
        @show

        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                        // .then((registration) => {
                        //     console.log('SW registered:', registration.scope);
                        // })
                        .catch((error) => {
                            console.log('SW registration failed:', error);
                        });
                });
            }
        </script>
    </body>
</html>
