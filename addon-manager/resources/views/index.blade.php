@extends('layouts.admin')

@section('title', 'Addon Manager')

@section('scripts')
    @parent
    <link rel="stylesheet" href="{{ $assetBase ?? asset('addon-manager/build') }}/manager.v1.css?v={{ ADDON_MANAGER_VERSION }}">
@endsection

@section('content-header')
    <h1>Addon Manager<small>Manage your Panel extensions.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Addon Manager</li>
    </ol>
@endsection

@section('content')
<div class="am" id="addon-manager"
     data-api-base="{{ $apiBase ?? url('/admin/addon-manager/api') }}"
     data-actor="{{ auth()->id() }}"
     data-csrf-token="{{ csrf_token() }}">
    <noscript><div class="am-notice am-notice--warning">JavaScript is required to manage addons and follow operation progress.</div></noscript>
    <div class="am-notice am-notice--error" id="am-notice" role="alert" hidden></div>

    <section class="am-card am-overview" aria-labelledby="am-overview-title">
        <div class="am-overview-copy">
            <span class="am-eyebrow">EXTENSIONS</span>
            <h2 id="am-overview-title">Your addons, in one place.</h2>
            <p>Install from GitHub, manage dependencies, and follow every change.</p>
            <span class="am-connection" id="am-connection" role="status">Connecting to the manager…</span>
        </div>
        <div class="am-overview-actions">
            <button class="am-button am-button--primary" type="button" id="am-install" disabled>
                <span aria-hidden="true">＋</span> Install addon
            </button>
            <button class="am-button am-button--quiet" type="button" id="am-doctor">Check manager health</button>
        </div>
    </section>

    <section class="am-stats" aria-label="Addon totals">
        <div class="am-stat"><span id="am-count-total">—</span><span>Installed addons</span></div>
        <div class="am-stat"><span id="am-count-enabled">—</span><span>Enabled</span></div>
        <div class="am-stat"><span id="am-count-disabled">—</span><span>Disabled</span></div>
    </section>

    <section class="am-card am-operation" id="am-operation" aria-labelledby="am-operation-title" tabindex="-1" hidden>
        <div class="am-section-heading">
            <div><span class="am-eyebrow">LATEST OPERATION</span><h3 id="am-operation-title">Operation progress</h3></div>
            <span class="am-badge" id="am-operation-status">Queued</span>
        </div>
        <p id="am-operation-message" class="am-operation-message" role="status" aria-live="polite"></p>
        <div class="am-progress" id="am-progress" role="progressbar" aria-label="Operation progress" aria-valuemin="0" aria-valuemax="100"><span id="am-progress-bar"></span></div>
        <div class="am-operation-footer">
            <span class="am-muted" id="am-operation-meta"></span>
            <div class="am-actions">
                <button class="am-button am-button--small" type="button" id="am-reconnect" hidden>Reconnect</button>
                <button class="am-button am-button--small" type="button" id="am-operation-details" disabled>View details</button>
            </div>
        </div>
    </section>

    <section class="am-card am-library" aria-labelledby="am-library-title">
        <div class="am-section-heading am-library-heading">
            <div><h3 id="am-library-title">Installed addons</h3><p class="am-muted">Only addons managed by Addon Manager appear here.</p></div>
            <button class="am-button am-button--small" type="button" id="am-refresh">Refresh</button>
        </div>
        <div class="am-filters">
            <div class="am-search"><label class="am-sr-only" for="am-search">Search addons by name or ID</label><input id="am-search" type="search" placeholder="Search by name or addon ID" autocomplete="off"></div>
            <div><label class="am-sr-only" for="am-filter">Filter addons by status</label><select id="am-filter"><option value="all">All statuses</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
            <span class="am-muted am-result-count" id="am-result-count" role="status"></span>
        </div>
        <div id="am-loading" class="am-empty" role="status"><span class="am-spinner" aria-hidden="true"></span><h4>Loading your addons</h4><p>Checking the installed registry.</p></div>
        <div id="am-empty" class="am-empty" hidden><span class="am-empty-icon" aria-hidden="true">＋</span><h4 id="am-empty-title">Ready for your first addon</h4><p id="am-empty-copy">Install an addon using its public GitHub package URL.</p><button class="am-button am-button--primary" type="button" id="am-empty-install" disabled>Install addon</button></div>
        <div class="am-table-wrap" id="am-table-wrap" hidden>
            <table class="am-table">
                <caption class="am-sr-only">Managed addons, their versions, relationships, and available actions</caption>
                <thead><tr><th scope="col">Addon</th><th scope="col">Version &amp; status</th><th scope="col">Dependencies</th><th scope="col">Actions</th></tr></thead>
                <tbody id="am-addons"></tbody>
            </table>
        </div>
    </section>

    <p class="am-footnote">Disable and delete preserve addon database tables and stored data. Package compatibility and file changes are checked before activation.</p>

    <dialog class="am-dialog" id="am-dialog" aria-labelledby="am-dialog-title" aria-describedby="am-dialog-description">
        <form id="am-dialog-form">
            <div class="am-dialog-heading"><h3 id="am-dialog-title"></h3><button class="am-close" id="am-dialog-close" type="button" aria-label="Close dialog">×</button></div>
            <p id="am-dialog-description" class="am-muted"></p>
            <div id="am-dialog-body"></div>
            <div class="am-notice am-notice--error" id="am-dialog-error" role="alert" hidden></div>
            <div class="am-dialog-footer"><button class="am-button" type="button" id="am-dialog-cancel">Cancel</button><button class="am-button am-button--primary" type="submit" id="am-dialog-submit">Continue</button></div>
        </form>
    </dialog>
</div>
@endsection

@section('footer-scripts')
    @parent
    <script src="{{ $assetBase ?? asset('addon-manager/build') }}/manager.v1.js?v={{ ADDON_MANAGER_VERSION }}" defer></script>
@endsection
