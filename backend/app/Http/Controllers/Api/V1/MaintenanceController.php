<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiProblem;
use App\Http\Controllers\Controller;
use App\Services\Maintenance\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    public function __invoke(Request $request, string $action, MaintenanceService $maintenance): JsonResponse
    {
        if ($request->all() !== []) {
            throw new ApiProblem('maintenance_options_not_allowed', 'Maintenance endpoints do not accept parameters.', 422);
        }

        return response()->json(['data' => $maintenance->run($action)]);
    }
}
