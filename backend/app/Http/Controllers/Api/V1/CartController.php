<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiProblem;
use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Services\Checkout\CartService;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function show(Request $request, CartService $service)
    {
        return response()->json(['data' => $service->view($service->cart($request->user()->id)), 'warnings' => []]);
    }

    public function preview(Request $request, CartService $service)
    {
        $input = $this->lines($request);

        return response()->json(['data' => $service->price($input['items'], 1, true), 'warnings' => []]);
    }

    public function add(Request $request, CartService $service)
    {
        $input = $request->validate(['offer_id' => ['required', 'integer', 'min:1'], 'quantity' => ['required', 'integer', 'between:1,10']]);

        return response()->json($service->mutate($request->user()->id, fn ($cart) => $service->add($cart, $input['offer_id'], $input['quantity'])), 201);
    }

    public function update(int $itemId, Request $request, CartService $service)
    {
        $input = $request->validate(['quantity' => ['required', 'integer', 'between:1,10']]);

        return response()->json($service->mutate($request->user()->id, function ($cart) use ($service, $itemId, $input) {
            $line = $cart->items()->findOrFail($itemId);
            $service->add($cart, $line->offer_id, $input['quantity'], true);
        }));
    }

    public function delete(int $itemId, Request $request, CartService $service)
    {
        $service->mutate($request->user()->id, fn ($cart) => $cart->items()->findOrFail($itemId)->delete() ? [] : []);

        return response()->noContent();
    }

    public function merge(Request $request, CartService $service)
    {
        $input = $this->lines($request);

        return response()->json($service->mutate($request->user()->id, function (Cart $cart) use ($input, $service) {
            $warnings = [];
            foreach ($input['items'] as $line) {
                $existing = $cart->items()->where('offer_id', $line['offer_id'])->value('quantity') ?? 0;
                $requested = $existing + $line['quantity'];
                if ($requested > 10) {
                    $warnings[] = 'An offer quantity was capped at 10.';
                }
                try {
                    $service->add($cart, $line['offer_id'], min(10, $requested), true);
                } catch (ApiProblem $e) {
                    $warnings[] = 'An unavailable offer or excess cart line was not merged.';
                }
            }

            return $warnings;
        }));
    }

    private function lines(Request $request): array
    {
        return $request->validate(['items' => ['required', 'array', 'max:50'], 'items.*.offer_id' => ['required', 'integer', 'min:1'], 'items.*.quantity' => ['required', 'integer', 'between:1,10']]);
    }
}
