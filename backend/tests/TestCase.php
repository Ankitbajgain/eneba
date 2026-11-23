<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (! str_ends_with((string) DB::connection()->getDatabaseName(), '_test')) {
            throw new \RuntimeException('Run tests with the dedicated Docker test service/database.');
        }
    }
}
