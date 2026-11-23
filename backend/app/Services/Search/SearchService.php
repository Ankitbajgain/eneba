<?php

namespace App\Services\Search;

use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SearchService
{
    public function normalize(string $value): string
    {
        return trim(preg_replace('/\s+/u', ' ', Str::lower(Str::ascii($value))));
    }

    public function grams(string $value): array
    {
        $chars = mb_str_split($this->normalize($value));
        $grams = [];
        for ($i = 0; $i < count($chars) - 2; $i++) {
            $grams[] = implode('', array_slice($chars, $i, 3));
        }

        return array_values(array_unique($grams));
    }

    public function index(Product $product): void
    {
        DB::transaction(function () use ($product): void {
            DB::table('product_search_grams')->where('product_id', $product->id)->delete();
            $rows = array_map(fn ($gram) => ['gram' => $gram, 'product_id' => $product->id], $this->grams($product->title));
            if ($rows) {
                DB::table('product_search_grams')->insertOrIgnore($rows);
            }
        });
    }

    public function ids(string $input): array
    {
        $q = $this->normalize($input);
        $literal = addcslashes($q, '%_\\');
        $direct = Product::where('is_published', true)->whereRaw('LOWER(title) LIKE ?', ['%'.$literal.'%'])->orderBy('id')->limit(100)->pluck('id')->all();
        $grams = $this->grams($q);
        $fuzzy = mb_strlen($q) >= 4 && $grams
            ? DB::table('product_search_grams')->select('product_id')->whereIn('gram', $grams)->groupBy('product_id')->orderByRaw('COUNT(*) DESC')->orderBy('product_id')->limit(100)->pluck('product_id')->all()
            : [];
        $candidates = array_slice(array_values(array_unique(array_merge($direct, $fuzzy))), 0, 100);
        $ranked = [];
        foreach (Product::where('is_published', true)->whereIn('id', $candidates)->get(['id', 'title']) as $product) {
            $title = $this->normalize($product->title);
            $score = $title === $q ? 0 : (str_starts_with($title, $q) ? 1 : (str_contains($title, $q) ? 2 : null));
            if ($score === null) {
                $distance = min(array_map(fn ($part) => $this->distance($q, $part), array_merge([$title], explode(' ', $title))));
                if ($distance > min(3, max(1, (int) floor(mb_strlen($q) / 4)))) {
                    continue;
                }
                $score = 3 + $distance;
            }
            $ranked[] = ['id' => $product->id, 'score' => $score];
        }
        usort($ranked, fn ($a, $b) => [$a['score'], $a['id']] <=> [$b['score'], $b['id']]);

        return array_column($ranked, 'id');
    }

    private function distance(string $a, string $b): int
    {
        $left = mb_str_split($a);
        $right = mb_str_split($b);
        $previous = range(0, count($right));
        foreach ($left as $i => $char) {
            $row = [$i + 1];
            foreach ($right as $j => $other) {
                $row[] = min($row[$j] + 1, $previous[$j + 1] + 1, $previous[$j] + ($char === $other ? 0 : 1));
            }
            $previous = $row;
        }

        return end($previous);
    }
}
