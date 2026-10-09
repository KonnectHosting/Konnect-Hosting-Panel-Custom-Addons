<li class="{{ request()->is('admin/addon-manager*') ? 'active' : '' }}">
    <a href="{{ url('/admin/addon-manager') }}"><i class="fa fa-puzzle-piece" aria-hidden="true"></i> <span>Addon Manager</span></a>
</li>
@foreach (($addonManagerAddonMenus ?? []) as $addonManagerAddonMenu)
    <li><a href="{{ $addonManagerAddonMenu['url'] }}"><i class="fa fa-plug" aria-hidden="true"></i> <span>{{ $addonManagerAddonMenu['label'] }}</span></a></li>
@endforeach
