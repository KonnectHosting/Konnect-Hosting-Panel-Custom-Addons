@extends('layouts.admin')

@section('title', 'Addon Demo')

@section('content-header')
    <h1>Addon Demo <small>Managed admin extension</small></h1>
@endsection

@section('content')
    <div class="row">
        <div class="col-xs-12">
            <div class="box box-primary">
                <div class="box-header with-border"><h3 class="box-title">Addon status</h3></div>
                <div class="box-body">
                    <p id="addon-manager-demo-message">The demo extension is enabled.</p>
                    <p>This page is registered by the addon manager and uses the existing admin session.</p>
                </div>
            </div>
        </div>
    </div>
@endsection
