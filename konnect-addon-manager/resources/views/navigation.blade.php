<li class="{{ request()->is('admin/konnect-addons*') ? 'active' : '' }}">
    <a href="{{ url('/admin/konnect-addons') }}"><i class="fa fa-puzzle-piece" aria-hidden="true"></i> <span>Addon Manager</span></a>
</li>
@foreach (($konnectAddonMenus ?? []) as $konnectAddonMenu)
    <li><a href="{{ $konnectAddonMenu['url'] }}"><i class="fa fa-plug" aria-hidden="true"></i> <span>{{ $konnectAddonMenu['label'] }}</span></a></li>
@endforeach
