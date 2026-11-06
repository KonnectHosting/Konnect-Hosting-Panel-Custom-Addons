@extends('layouts.admin')
@section('title', 'GMod Toolkit')
@section('content-header')
    <h1>GMod Toolkit <small>Workshop and Panel FastDL</small></h1>
@endsection
@section('content')
    @php($settings = app(\Pterodactyl\Addons\GmodToolkit\State::class)->read('settings'))
    @if(session('status'))<div class="alert alert-success">{{ session('status') }}</div>@endif
    <div class="box box-primary"><div class="box-body">
        <h3>Enable customer tools for Garry's Mod eggs</h3>
        <p>GMod eggs are recognized automatically by name/startup. This optional override lets you choose custom eggs. Customer operations require file read permissions; changes also require file create and update. Workshop Lua uses /home/container/garrysmod. FastDL publishes only from /home/container/fastdl.</p>
        <form method="post" action="/admin/addon-manager/extensions/gmod.toolkit/settings/save">
            @csrf
            <label style="display:block"><input type="checkbox" name="automatic" value="1" @if(!array_key_exists('eggs', $settings)) checked @endif> Automatically recognize GMod eggs (default)</label>
            @foreach(\Pterodactyl\Models\Egg::orderBy('name')->get(['id', 'name']) as $egg)
                <label style="display:block"><input type="checkbox" name="eggs[]" value="{{ $egg->id }}" @if(in_array((int) $egg->id, $settings['eggs'] ?? [], true)) checked @endif> {{ $egg->name }} (#{{ $egg->id }})</label>
            @endforeach
            <button type="submit" class="btn btn-primary">Save enabled eggs</button>
        </form>
        <p>FastDL uses the Panel domain, existing queue and Wings file API. Installing this addon is the complete deployment; there are no node services or game-container scripts to provision.</p>
    </div></div>
@endsection
