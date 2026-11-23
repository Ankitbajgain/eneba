<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Http\Resources\ProductResource;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use App\Services\Catalog\CatalogService;
use App\Services\Search\SearchService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CatalogController extends Controller
{
    public function index(Request $request, CatalogService $catalog)
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'string', 'min:2', 'max:100'], 'platform' => ['sometimes', 'string', Rule::exists('platforms', 'code')],
            'region' => ['sometimes', 'string', Rule::exists('regions', 'code')], 'min_price' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'max_price' => ['sometimes', 'integer', 'min:0', 'max:10000000'], 'available' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', Rule::in(['relevance', 'price_asc', 'price_desc', 'name_asc', 'newest'])], 'page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'between:1,48'],
        ]);
        if (isset($filters['min_price'], $filters['max_price']) && $filters['max_price'] < $filters['min_price']) {
            throw ValidationException::withMessages(['max_price' => ['Maximum price must be at least the minimum price.']]);
        }
        $page = $catalog->query($filters)->paginate($filters['per_page'] ?? 24);

        return response()->json(['data' => ProductResource::collection($page)->resolve(), 'meta' => $this->meta($page)]);
    }

    public function show(string $slug, CatalogService $catalog)
    {
        return new ProductResource($catalog->query()->where('slug', $slug)->firstOrFail());
    }

    public function offers(string $slug, Request $request)
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'between:1,48']]);
        $product = Product::where('is_published', true)->where('slug', $slug)->firstOrFail();
        $page = $product->offers()->where('is_active', true)->with(['seller', 'platform', 'region', 'product'])
            ->withExists(['keys as in_stock' => fn ($q) => $q->whereNull('order_item_id')])
            ->withCount(['keys as available_keys_count' => fn ($q) => $q->whereNull('order_item_id')])->orderByDesc('in_stock')->orderBy('price_minor')->orderBy('id')->paginate($request->integer('per_page', 24));

        return response()->json(['data' => OfferResource::collection($page)->resolve(), 'meta' => $this->meta($page)]);
    }

    public function filters()
    {
        return response()->json(['data' => ['platforms' => Platform::orderBy('id')->get(['code', 'name']), 'regions' => Region::orderBy('id')->get(['code', 'name', 'activation_note'])]]);
    }

    public function search(Request $request, CatalogService $catalog)
    {
        $input = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100'], 'limit' => ['sometimes', 'integer', 'between:1,20']]);
        $products = $catalog->query(['q' => $input['q']])->limit($input['limit'] ?? 8)->get();

        return response()->json(['data' => $products->map(function ($product) use ($input) {
            $data = (new ProductResource($product))->resolve();
            $title = app(SearchService::class)->normalize($product->title);
            $q = app(SearchService::class)->normalize($input['q']);
            $data['match_type'] = $title === $q ? 'exact' : (str_starts_with($title, $q) ? 'prefix' : (str_contains($title, $q) ? 'partial' : 'fuzzy'));

            return $data;
        })]);
    }

    private function meta($page): array
    {
        return ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()];
    }
}
