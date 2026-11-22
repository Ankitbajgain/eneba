<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiProblem;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\DigitalKey;
use App\Models\Order;
use App\Services\Checkout\CheckoutService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function checkout(Request $request, CheckoutService $checkout)
    {
        $request->merge(['idempotency_key' => $request->header('Idempotency-Key')]);
        $input = $request->validate(['idempotency_key' => ['required', 'uuid'], 'cart_revision' => ['required', 'integer', 'min:1'], 'simulate_result' => ['required', 'in:success,decline']]);
        [$order,$replay] = $checkout->purchase($request->user()->id, $input, strtolower($input['idempotency_key']));
        $response = response()->json(['data' => (new OrderResource($order))->resolve()], $replay ? 200 : 201);
        if ($replay) {
            $response->header('Idempotency-Replayed', 'true');
        }

        return $response;
    }

    public function index(Request $request)
    {
        $input = $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'between:1,48']]);
        $page = Order::where('user_id', $request->user()->id)->with(['items', 'payment'])->orderByDesc('created_at')->orderByDesc('id')->paginate($input['per_page'] ?? 24);

        return response()->json(['data' => OrderResource::collection($page)->resolve(), 'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()]]);
    }

    public function show(string $orderId, Request $request)
    {
        return new OrderResource($this->owned($orderId, $request));
    }

    public function keys(string $orderId, Request $request)
    {
        $order = $this->owned($orderId, $request);
        if ($order->status !== 'fulfilled') {
            throw new ApiProblem('order_not_fulfilled', 'Keys are available only for fulfilled orders.');
        }

        return response()->json(['data' => DigitalKey::whereIn('order_item_id', $order->items->pluck('id'))->orderBy('id')->get()->map(fn ($key) => ['order_item_id' => $key->order_item_id, 'value' => $key->encrypted_value])]);
    }

    private function owned(string $id, Request $request): Order
    {
        return Order::where('user_id', $request->user()->id)->where('public_id', $id)->with(['items', 'payment'])->firstOrFail();
    }
}
