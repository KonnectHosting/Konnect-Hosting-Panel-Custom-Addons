@extends('layouts.admin')

@section('title', 'Addon Manager')

@section('scripts')
    @parent
    <link rel="stylesheet" href="{{ $assetBase ?? asset('konnect-addon-manager/build') }}/manager.v1.css">
@endsection

@section('content-header')
    <h1>Addon Manager<small>Manage your Panel extensions.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Addon Manager</li>
    </ol>
@endsection

@section('content')
<div class="kam" id="konnect-addon-manager"
     data-api-base="{{ $apiBase ?? url('/admin/konnect-addons/api') }}"
     data-actor="{{ auth()->id() }}"
     data-csrf-token="{{ csrf_token() }}">
    <noscript><div class="kam-notice kam-notice--warning">JavaScript is required to manage addons and follow operation progress.</div></noscript>
    <div class="kam-notice kam-notice--error" id="kam-notice" role="alert" hidden></div>

    <section class="kam-card kam-overview" aria-labelledby="kam-overview-title">
        <div class="kam-overview-copy">
            <span class="kam-eyebrow">KONNECT EXTENSIONS</span>
            <h2 id="kam-overview-title">Your addons, in one place.</h2>
            <p>Install from GitHub, manage dependencies, and follow every change.</p>
            <span class="kam-connection" id="kam-connection" role="status">Connecting to the manager…</span>
        </div>
        <div class="kam-overview-actions">
            <button class="kam-button kam-button--primary" type="button" id="kam-install" disabled>
                <span aria-hidden="true">＋</span> Install addon
            </button>
            <button class="kam-button kam-button--quiet" type="button" id="kam-doctor">Check manager health</button>
        </div>
    </section>

    <section class="kam-stats" aria-label="Addon totals">
        <div class="kam-stat"><span id="kam-count-total">—</span><span>Installed addons</span></div>
        <div class="kam-stat"><span id="kam-count-enabled">—</span><span>Enabled</span></div>
        <div class="kam-stat"><span id="kam-count-disabled">—</span><span>Disabled</span></div>
    </section>

    <section class="kam-card kam-operation" id="kam-operation" aria-labelledby="kam-operation-title" hidden>
        <div class="kam-section-heading">
            <div><span class="kam-eyebrow">LATEST OPERATION</span><h3 id="kam-operation-title">Operation progress</h3></div>
            <span class="kam-badge" id="kam-operation-status">Queued</span>
        </div>
        <p id="kam-operation-message" class="kam-operation-message" role="status" aria-live="polite"></p>
        <div class="kam-progress" id="kam-progress" role="progressbar" aria-label="Operation progress" aria-valuemin="0" aria-valuemax="100"><span id="kam-progress-bar"></span></div>
        <div class="kam-operation-footer">
            <span class="kam-muted" id="kam-operation-meta"></span>
            <div class="kam-actions">
                <button class="kam-button kam-button--small" type="button" id="kam-reconnect" hidden>Reconnect</button>
                <button class="kam-button kam-button--small" type="button" id="kam-operation-details" disabled>View details</button>
            </div>
        </div>
    </section>

    <section class="kam-card kam-library" aria-labelledby="kam-library-title">
        <div class="kam-section-heading kam-library-heading">
            <div><h3 id="kam-library-title">Installed addons</h3><p class="kam-muted">Only addons managed by Konnect appear here.</p></div>
            <button class="kam-button kam-button--small" type="button" id="kam-refresh">Refresh</button>
        </div>
        <div class="kam-filters">
            <div class="kam-search"><label class="kam-sr-only" for="kam-search">Search addons by name or ID</label><input id="kam-search" type="search" placeholder="Search by name or addon ID" autocomplete="off"></div>
            <div><label class="kam-sr-only" for="kam-filter">Filter addons by status</label><select id="kam-filter"><option value="all">All statuses</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
            <span class="kam-muted kam-result-count" id="kam-result-count" role="status"></span>
        </div>
        <div id="kam-loading" class="kam-empty" role="status"><span class="kam-spinner" aria-hidden="true"></span><h4>Loading your addons</h4><p>Checking the installed registry.</p></div>
        <div id="kam-empty" class="kam-empty" hidden><span class="kam-empty-icon" aria-hidden="true">＋</span><h4 id="kam-empty-title">Ready for your first addon</h4><p id="kam-empty-copy">Install an addon using its public GitHub package URL.</p><button class="kam-button kam-button--primary" type="button" id="kam-empty-install" disabled>Install addon</button></div>
        <div class="kam-table-wrap" id="kam-table-wrap" hidden>
            <table class="kam-table">
                <caption class="kam-sr-only">Managed addons, their versions, relationships, and available actions</caption>
                <thead><tr><th scope="col">Addon</th><th scope="col">Version &amp; status</th><th scope="col">Dependencies</th><th scope="col">Actions</th></tr></thead>
                <tbody id="kam-addons"></tbody>
            </table>
        </div>
    </section>

    <p class="kam-footnote">Disable and delete preserve addon database tables and stored data. Package compatibility and file changes are checked before activation.</p>

    <dialog class="kam-dialog" id="kam-dialog" aria-labelledby="kam-dialog-title" aria-describedby="kam-dialog-description">
        <form id="kam-dialog-form">
            <div class="kam-dialog-heading"><h3 id="kam-dialog-title"></h3><button class="kam-close" id="kam-dialog-close" type="button" aria-label="Close dialog">×</button></div>
            <p id="kam-dialog-description" class="kam-muted"></p>
            <div id="kam-dialog-body"></div>
            <div class="kam-notice kam-notice--error" id="kam-dialog-error" role="alert" hidden></div>
            <div class="kam-dialog-footer"><button class="kam-button" type="button" id="kam-dialog-cancel">Cancel</button><button class="kam-button kam-button--primary" type="submit" id="kam-dialog-submit">Continue</button></div>
        </form>
    </dialog>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script src="{{ $assetBase ?? asset('konnect-addon-manager/build') }}/manager.v1.js" defer></script>
@endsection
