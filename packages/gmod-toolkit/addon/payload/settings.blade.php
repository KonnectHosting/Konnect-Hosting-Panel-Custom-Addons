@extends('layouts.admin')
@section('title', 'GMod Toolkit')
@section('content-header')
    <h1>GMod Toolkit <small>Workshop and node FastDL</small></h1>
@endsection
@section('content')
    @php($settings = app(\Pterodactyl\Addons\GmodToolkit\State::class)->read('settings'))
    @if(session('status'))<div class="alert alert-success">{{ session('status') }}</div>@endif
    <div class="box box-primary"><div class="box-body">
        <h3>Enable customer tools for Garry's Mod eggs</h3>
        <p>Choose the actual GMod eggs used on this installation. Customer operations require file read permissions; changes also require file create and update. This addon expects the game in /home/container/garrysmod.</p>
        <form method="post" action="/admin/addon-manager/extensions/gmod.toolkit/settings/save">
            @csrf
            @foreach(\Pterodactyl\Models\Egg::orderBy('name')->get(['id', 'name']) as $egg)
                <label style="display:block"><input type="checkbox" name="eggs[]" value="{{ $egg->id }}" @if(in_array((int) $egg->id, $settings['eggs'] ?? [], true)) checked @endif> {{ $egg->name }} (#{{ $egg->id }})</label>
            @endforeach
            <button type="submit" class="btn btn-primary">Save enabled eggs</button>
        </form>
    </div></div>
    <div class="box"><div class="box-body">
        <h3>Provision a FastDL node</h3>
        <p>Workshop tools use Wings directly. FastDL requires the companion publisher once per node and the supplied Nginx locations on HTTPS port 443 at the node FQDN. Download its private configuration below, then follow packages/gmod-toolkit/node/README.md. Keep config.json private; it contains the node API key.</p>
        <form method="post" action="/admin/addon-manager/extensions/gmod.toolkit/nodes/provision">
            @csrf
            <label for="gmod-node">Node</label><select id="gmod-node" name="node" class="form-control">
                @foreach(\Pterodactyl\Models\Node::orderBy('name')->get(['id', 'name', 'fqdn']) as $node)
                    <option value="{{ $node->id }}">{{ $node->name }} — {{ $node->fqdn }}</option>
                @endforeach
            </select>
            <label for="gmod-volumes">Wings volume directory on that node</label>
            <input id="gmod-volumes" name="volume_root" value="/var/lib/pterodactyl/volumes" class="form-control" required>
            <button type="submit" class="btn btn-primary" style="margin-top:12px">Download private node config</button>
        </form>
        <p style="margin-top:12px">A repeated download retains the existing API key. Node downloads remain available until their URL is revoked or the node publisher is stopped. Revoke publications before disabling or deleting the addon if you want public downloads stopped; private backups and published data are retained.</p>
    </div></div>
@endsection
