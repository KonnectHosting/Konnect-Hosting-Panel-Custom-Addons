@extends('layouts.admin')

@section('title')
Server — {{ $server->name }}: Subdomains
@endsection

@section('content-header')
<h1>{{ $server->name }}<small>Manage this server's subdomains.</small></h1>
<ol class="breadcrumb">
    <li><a href="{{ route('admin.index') }}">Admin</a></li>
    <li><a href="{{ route('admin.servers') }}">Servers</a></li>
    <li><a href="{{ route('admin.servers.view', $server->id) }}">{{ $server->name }}</a></li>
    <li class="active">Subdomains</li>
</ol>
@endsection

@section('content')
@include('admin.servers.partials.navigation')

<div class="row">
    <div class="col-sm-7">
        <div class="box box-primary">
            <div class="box-header with-border">
                <h3 class="box-title">Subdomains on server</h3>
            </div>
            <div class="box-body table-responsible no-padding">
                <table class="table table-hover">
                    <tr>
                        <th>ID</th>
                        <th>User's domain</th>
                        <th>Parent domain</th>
                        <th>Created at</th>
                        <th>Force Delete</th>
                    </tr>
                    @foreach($userSubdomains as $subdomain)
                    <tr>
                        <td>{{ $subdomain->id }}</td>
                        <td>{{ $subdomain->full_domain }}</td>
                        <td>{{ $subdomain->domain }}</td>
                        <td>{{ $subdomain->created_at }}</td>
                        <td>
                            <form action="{{ route('admin.domain.forceDelete', $server->id) }}" method="POST">
                                {!! csrf_field() !!}
                                <input type="hidden" name="subdomain_id" value="{{ $subdomain->id }}">
                                <button type="submit" class="btn btn-xs btn-danger" title="Warning: This will force the domain to be deleted from the DB even if Cloudflare still errors out.">Delete</button>
                            </form>
                    </tr>
                    @endforeach
                </table>
            </div>
        </div>
    </div>
    <div class="col-sm-5">
        <div class="box box-success">
            <div class="box-header with-border">
                <h3 class="box-title">Subdomain Limits</h3>
            </div>
            <form action="{{ route('admin.domain.config.update', $server->id) }}" method="POST">
                <div class="box-body">
                    <div class="form-group m-2">
                        <label for="subdomain_limit" class="control-label">Subdomain count</label>
                        <div>
                            <input type="text" name="subdomain_limit" class="form-control" value="{{ old('subdomain_limit', $server->subdomain_limit) }}"/>
                        </div>
                        <p class="text-muted small">The total number of subdomains a user is allowed to create for this server.</p>
                    </div>
                    <div class="box-footer">
                        {!! csrf_field() !!}
                        <button type="submit" class="btn btn-primary pull-right">Update config</button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection
