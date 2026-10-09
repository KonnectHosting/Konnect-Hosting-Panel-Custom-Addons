@if($siteConfiguration['arix']['mail']['editor'] === 'developer')
    <?php
        $html = $siteConfiguration['arix']['mail']['developerCode'];

        switch ($level) {
            case 'success':
                $actionColor = '#22BC66';
                break;
            case 'error':
                $actionColor = '#dc4d2f';
                break;
            default:
                $actionColor = $siteConfiguration['arix']['mail']['color'];
        }

        // {{greeting style="..."}}
        preg_match('/\{\{greeting(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $greetingStyle = $matches[1] ?? 'margin-top: 0; color: #212127; font-size: 19px; font-weight: bold;';
        $greetingText = !empty($greeting) ? $greeting : ($level == 'error' ? 'Whoops!' : 'Hello!');
        $html = preg_replace('/\{\{greeting(?:\s+style="[^"]*")?\}\}/', '<h1 style="' . $greetingStyle . '">' . $greetingText . '</h1>', $html);

        // {{introLines style="..."}}
        preg_match('/\{\{introLines(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $introStyle = $matches[1] ?? 'margin-top: 0; color: #484858; font-size: 16px; line-height: 1.5em;';
        $introHtml = '';
        foreach ($introLines as $line) {
            $introHtml .= '<p style="' . $introStyle . '">' . $line . '</p>';
        }
        $html = preg_replace('/\{\{introLines(?:\s+style="[^"]*")?\}\}/', $introHtml, $html);

        // {{outroLines style="..."}}
        preg_match('/\{\{outroLines(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $outroStyle = $matches[1] ?? 'margin-top: 0; color: #484858; font-size: 16px; line-height: 1.5em;';
        $outroHtml = '';
        foreach ($outroLines as $line) {
            $outroHtml .= '<p style="' . $outroStyle . '">' . $line . '</p>';
        }
        $html = preg_replace('/\{\{outroLines(?:\s+style="[^"]*")?\}\}/', $outroHtml, $html);

        // {{actionButton}} - no styling, fixed
        $actionHtml = '';
        if (isset($actionText)) {
            $actionHtml = '<table width="100%" style="margin: 30px auto; text-align: center;"><tr><td align="center"><a href="' . $actionUrl . '" style="display: inline-block; width: 200px; padding: 10px; background-color: ' . $actionColor . '; border-radius: 3px; color: #fff; font-size: 15px; text-decoration: none;">' . $actionText . '</a></td></tr></table>';
        }
        $html = preg_replace('/\{\{actionButton\}\}/', $actionHtml, $html);

        // {{subCopy style="..."}}
        preg_match('/\{\{subCopy(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $subCopyStyle = $matches[1] ?? 'margin-top: 25px; padding: 10px 15px; border-radius: 7px; background-color: rgb(0,0,0,0.02); border: 1px solid #D0D0FF;';
        $subCopyHtml = '';
        if (isset($actionText)) {
            $subCopyHtml = '<table style="' . $subCopyStyle . '"><tr><td style="max-width: 490px;"><p style="margin-top: 0; color: #5B5B71; font-size: 12px; line-height: 1.5em;">If you\'re having trouble clicking the "' . $actionText . '" button, copy and paste the URL below into your web browser:</p><p style="margin-top: 0; color: #5B5B71; font-size: 12px; line-height: 1.5em;"><a style="color: #3869D4;" href="' . $actionUrl . '">' . $actionUrl . '</a></p></td></tr></table>';
        }
        $html = preg_replace('/\{\{subCopy(?:\s+style="[^"]*")?\}\}/', $subCopyHtml, $html);
    ?>
    {!! $html !!}
@elseif ($siteConfiguration['arix']['mail']['editor'] === 'editor')
    <?php
        $html = $siteConfiguration['arix']['mail']['editorCode'];

        switch ($level) {
            case 'success':
                $actionColor = '#22BC66';
                break;
            case 'error':
                $actionColor = '#dc4d2f';
                break;
            default:
                $actionColor = $siteConfiguration['arix']['mail']['color'];
        }

        // {{greeting style="..."}}
        preg_match('/\{\{greeting(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $greetingStyle = $matches[1] ?? 'margin-top: 0; color: #212127; font-size: 19px; font-weight: bold;';
        $greetingText = !empty($greeting) ? $greeting : ($level == 'error' ? 'Whoops!' : 'Hello!');
        $html = preg_replace('/\{\{greeting(?:\s+style="[^"]*")?\}\}/', '<h1 style="' . $greetingStyle . '">' . $greetingText . '</h1>', $html);

        // {{introLines style="..."}}
        preg_match('/\{\{introLines(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $introStyle = $matches[1] ?? 'margin-top: 0; color: #484858; font-size: 16px; line-height: 1.5em;';
        $introHtml = '';
        foreach ($introLines as $line) {
            $introHtml .= '<p style="' . $introStyle . '">' . $line . '</p>';
        }
        $html = preg_replace('/\{\{introLines(?:\s+style="[^"]*")?\}\}/', $introHtml, $html);

        // {{outroLines style="..."}}
        preg_match('/\{\{outroLines(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $outroStyle = $matches[1] ?? 'margin-top: 0; color: #484858; font-size: 16px; line-height: 1.5em;';
        $outroHtml = '';
        foreach ($outroLines as $line) {
            $outroHtml .= '<p style="' . $outroStyle . '">' . $line . '</p>';
        }
        $html = preg_replace('/\{\{outroLines(?:\s+style="[^"]*")?\}\}/', $outroHtml, $html);

        // {{actionButton}} - no styling, fixed
        $actionHtml = '';
        if (isset($actionText)) {
            $actionHtml = '<table width="100%" style="margin: 30px auto; text-align: center;"><tr><td align="center"><a href="' . $actionUrl . '" style="display: inline-block; width: 200px; padding: 10px; background-color: ' . $actionColor . '; border-radius: 3px; color: #fff; font-size: 15px; text-decoration: none;">' . $actionText . '</a></td></tr></table>';
        }
        $html = preg_replace('/\{\{actionButton\}\}/', $actionHtml, $html);

        // {{subCopy style="..."}}
        preg_match('/\{\{subCopy(?:\s+style="([^"]*)")?\}\}/', $html, $matches);
        $subCopyStyle = $matches[1] ?? 'margin-top: 25px; padding: 10px 15px; border-radius: 7px; background-color: rgb(0,0,0,0.02); border: 1px solid #D0D0FF;';
        $subCopyHtml = '';
        if (isset($actionText)) {
            $subCopyHtml = '<table style="' . $subCopyStyle . '"><tr><td style="max-width: 490px;"><p style="margin-top: 0; color: #5B5B71; font-size: 12px; line-height: 1.5em;">If you\'re having trouble clicking the "' . $actionText . '" button, copy and paste the URL below into your web browser:</p><p style="margin-top: 0; color: #5B5B71; font-size: 12px; line-height: 1.5em;"><a style="color: #3869D4;" href="' . $actionUrl . '">' . $actionUrl . '</a></p></td></tr></table>';
        }
        $html = preg_replace('/\{\{subCopy(?:\s+style="[^"]*")?\}\}/', $subCopyHtml, $html);
    ?>
    {!! $html !!}
@else
<!DOCTYPE html>
<html>

<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />

    <style type="text/css" rel="stylesheet" media="all">
        /* Media Queries */
        @media only screen and (max-width: 500px) {
            .button {
                width: 100% !important;
            }
        }
    </style>
</head>

<?php

$style = [
    /* Layout ------------------------------ */

    'body' => 'margin: 0; padding: 15px 5px; width: 100%; background-color: #f5f5ff;',
    'email-wrapper' => 'width: 100%; max-width: 570px; margin: 0 auto; padding: 0; display: block;',

    /* Masthead ----------------------- */

    'email-masthead' => 'padding: 25px 0;',
    'email-masthead_name' => 'font-size: 20px; display: flex; align-items: center; column-gap: 10px; font-weight: 500; text-decoration: none; color: #576072;',

    'email-body' => 'width: 570px; display: block; padding: 20px 25px; border-radius: 10px; border: 1px solid #D0D0FF; background-color: #fff; border-top: 3px solid ' . $siteConfiguration['arix']['mail']['color'] . ';',

    'email-footer' => 'padding: 25px 0;',
    'email-footer_top' => 'display: flex; align-items: center; justify-content: space-between; padding-bottom: 25px;',
    'email-footer_bottom' => 'display: flex; align-items: center; column-gap: 20px; padding-top: 25px; border-top: 1px solid #576072;',
    'email-footer_links' => 'color: #576072;',
    'email-footer_copyright' => 'padding-top: 10px; color: #576072;',
    'email-footer_small' => 'font-size: 12px;',

    /* Body ------------------------------ */

    'body_action' => 'width: 100%; margin: 30px auto; padding: 0; text-align: center;',
    'body_sub' => 'margin-top: 25px; display: block; padding: 10px 15px; border-radius: 7px; background-color: rgb(0, 0, 0, 0.02); border: 1px solid #D0D0FF;',

    /* Type ------------------------------ */

    'anchor' => 'color: #3869D4;',
    'header-1' => 'margin-top: 0; color: #212127; font-size: 19px; font-weight: bold; text-align: left;',
    'paragraph' => 'margin-top: 0; color: #484858; font-size: 16px; line-height: 1.5em;',
    'paragraph-sub' => 'margin-top: 0; color: #5B5B71; font-size: 12px; line-height: 1.5em;',
    'paragraph-center' => 'text-align: center;',
    'mb-0' => 'margin-bottom: 0;',

    /* Buttons ------------------------------ */

    'button' => 'display: block; display: inline-block; width: 200px; min-height: 20px; padding: 10px; background-color: ' . $siteConfiguration['arix']['mail']['color'] . '; border-radius: 3px; color: #ffffff; font-size: 15px; line-height: 25px; text-align: center; text-decoration: none; -webkit-text-size-adjust: none;',

    'button--green' => 'background-color: #22BC66;',
    'button--red' => 'background-color: #dc4d2f;',
    'button--blue' => 'background-color: ' . $siteConfiguration['arix']['mail']['color'] . ';',
];
?>

<?php $fontFamily = 'font-family: Arial, \'Helvetica Neue\', Helvetica, sans-serif;'; ?>

<body style="{{ $style['body'] }}">

    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="{{ $style['email-wrapper'] }}" align="center">
                <table width="570px" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="{{ $style['email-masthead'] }}">
                            <a style="{{ $fontFamily }} {{ $style['email-masthead_name'] }}" href="{{ url('/') }}" target="_blank">
                                <img src="{{ $siteConfiguration['arix']['mail']['logo'] }}" style="height: 36px" alt="Logo" />
                                {{ $siteConfiguration['arix']['mail']['logoFull'] === false ? config('app.name') : '' }}
                            </a>
                        </td>
                    </tr>

                    <tr>
                        <td style="{{ $fontFamily }} {{ $style['email-body'] }}" width="570px">

                            <!-- Greeting -->
                            <h1 style="{{ $style['header-1'] }}">
                                @if (! empty($greeting))
                                    {{ $greeting }}
                                @else
                                    @if ($level == 'error')
                                        Whoops!
                                    @else
                                        Hello!
                                    @endif
                                @endif
                            </h1>

                            <!-- Intro -->
                            @foreach ($introLines as $line)
                                <p style="{{ $style['paragraph'] }}">
                                    {{ $line }}
                                </p>
                            @endforeach

                            <!-- Action Button -->
                            @if (isset($actionText))
                                <table style="{{ $style['body_action'] }}" align="center" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center">
                                            <?php
                                                switch ($level) {
                                                    case 'success':
                                                        $actionColor = 'button--green';
                                                        break;
                                                    case 'error':
                                                        $actionColor = 'button--red';
                                                        break;
                                                    default:
                                                        $actionColor = 'button--blue';
                                                }
                                            ?>

                                            <a href="{{ $actionUrl }}"
                                                style="{{ $fontFamily }} {{ $style['button'] }} {{ $style[$actionColor] }}"
                                                class="button"
                                                target="_blank">
                                                {{ $actionText }}
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            <!-- Outro -->
                            @foreach ($outroLines as $line)
                                <p style="{{ $style['paragraph'] }}">
                                    {{ $line }}
                                </p>
                            @endforeach

                            <!-- Salutation -->
                            <p style="{{ $style['paragraph'] }} {{ $style['mb-0'] }}">
                                Regards,<br>{{ config('app.name') }}
                            </p>

                            <!-- Sub Copy -->
                            @if (isset($actionText))
                                <table style="{{ $style['body_sub'] }}">
                                    <tr>
                                        <td style="{{ $fontFamily }}" style="max-width: 490px;">
                                            <p style="{{ $style['paragraph-sub'] }}">
                                                If you're having trouble clicking the "{{ $actionText }}" button,
                                                copy and paste the URL below into your web browser:
                                            </p>

                                            <p style="{{ $style['paragraph-sub'] }}">
                                                <a style="{{ $style['anchor'] }}" href="{{ $actionUrl }}" target="_blank">
                                                    {{ $actionUrl }}
                                                </a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            @endif
                        </td>
                    </tr>
                </table>

                <table width="570px" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="{{ $style['email-footer'] }}">
                            <table width="570px" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="{{ $style['email-footer_top'] }}">
                                        <a style="{{ $fontFamily }} {{ $style['email-footer_links'] }}" href="{{ url('/') }}" target="_blank">
                                            {{ config('app.name') }}
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="{{ $style['email-footer_bottom'] }}">
                                        @if ($siteConfiguration['arix']['mail']['billing'])
                                            <a style="{{ $fontFamily }} {{ $style['email-footer_links'] }} {{ $style['email-footer_small'] }}" href="{{ $siteConfiguration['arix']['mail']['billing'] }}" target="_blank">
                                                Billing area
                                            </a>
                                        @endif
                                        @if ($siteConfiguration['arix']['mail']['support'])
                                            <a style="{{ $fontFamily }} {{ $style['email-footer_links'] }} {{ $style['email-footer_small'] }}" href="{{ $siteConfiguration['arix']['mail']['support'] }}" target="_blank">
                                                Support
                                            </a>
                                        @endif
                                        @if ($siteConfiguration['arix']['mail']['status'])
                                            <a style="{{ $fontFamily }} {{ $style['email-footer_links'] }} {{ $style['email-footer_small'] }}" href="{{ $siteConfiguration['arix']['mail']['status'] }}" target="_blank">
                                                Status page
                                            </a>
                                        @endif
                                    </td>
                                </tr>
                                <tr>
                                    <td style="{{ $style['email-footer_copyright'] }} {{ $style['email-footer_small'] }}">
                                        © 2026 {{ config('app.name') }}. All rights reserved.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

</body>
</html>
@endif
