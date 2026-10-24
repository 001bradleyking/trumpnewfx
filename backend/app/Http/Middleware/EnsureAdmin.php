<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $adminEmail = strtolower(trim((string) config('newsfx.admin_email')));
        $user = Auth::user();

        if ($adminEmail === '' || ! $user || ! hash_equals($adminEmail, strtolower(trim($user->email)))) {
            abort(404);
        }

        return $next($request);
    }
}
