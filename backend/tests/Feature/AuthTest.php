<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use DatabaseTransactions;

    private function registration(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Demo Player',
            'email' => 'player-'.fake()->uuid().'@example.test',
            'password' => 'a-long-demo-password',
            'password_confirmation' => 'a-long-demo-password',
        ], $overrides);
    }

    public function test_registration_hashes_password_and_establishes_a_safe_session(): void
    {
        $input = $this->registration(['email' => '  PLAYER@example.test  ']);
        $this->postJson('/api/v1/auth/register', $input)
            ->assertCreated()
            ->assertExactJson(['data' => ['id' => User::where('email', 'player@example.test')->value('id'), 'name' => 'Demo Player', 'email' => 'player@example.test']])
            ->assertHeader('Cache-Control', 'no-store, private');
        $user = User::where('email', 'player@example.test')->firstOrFail();
        $this->assertTrue(Hash::check($input['password'], $user->password));
        $this->assertAuthenticatedAs($user, 'web');
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_invalid_registration_creates_no_account(): void
    {
        $input = $this->registration(['password' => 'short', 'password_confirmation' => 'different']);
        $this->postJson('/api/v1/auth/register', $input)
            ->assertUnprocessable()->assertJsonPath('code', 'validation_failed')->assertJsonValidationErrors('password');
        $this->assertDatabaseMissing('users', ['email' => $input['email']]);
    }

    public function test_duplicate_email_is_case_insensitive_and_does_not_overwrite_account(): void
    {
        $user = User::factory()->create(['email' => 'existing@example.test']);
        $this->postJson('/api/v1/auth/register', $this->registration(['email' => 'EXISTING@example.test']))
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertSame($user->name, $user->fresh()->name);
    }

    public function test_multibyte_password_over_bcrypt_byte_limit_is_validation_error(): void
    {
        $password = str_repeat('界', 30);
        $this->postJson('/api/v1/auth/register', $this->registration(['password' => $password, 'password_confirmation' => $password]))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_login_rotates_session_and_logout_invalidates_authentication(): void
    {
        $user = User::factory()->create(['email' => 'login@example.test', 'password' => 'a-long-demo-password']);
        $this->withSession(['marker' => 'before-login']);
        $before = session()->getId();
        $this->postJson('/api/v1/auth/login', ['email' => 'LOGIN@example.test', 'password' => 'a-long-demo-password'])
            ->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonMissingPath('data.password');
        $this->assertNotSame($before, session()->getId());
        $token = session()->token();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->assertGuest('web');
        $this->assertNotSame($token, session()->token());
        // Each real HTTP request gets a new request-scoped Sanctum guard.
        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
    }

    public function test_wrong_and_unknown_credentials_have_the_same_generic_response(): void
    {
        User::factory()->create(['email' => 'known@example.test']);
        foreach (['known@example.test', 'missing@example.test'] as $email) {
            $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'incorrect-password'])
                ->assertUnauthorized()->assertExactJson(['message' => 'The email or password is incorrect.', 'code' => 'invalid_credentials']);
        }
        $this->assertGuest('web');
    }

    public function test_guests_cannot_access_session_endpoints(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
    }

    public function test_current_user_cannot_select_another_account(): void
    {
        $mine = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($mine, 'web')->getJson('/api/v1/auth/me?user_id='.$other->id)
            ->assertOk()->assertJsonPath('data.id', $mine->id)->assertJsonMissingPath('data.password');
    }

    public function test_login_is_rate_limited_with_retry_after(): void
    {
        $input = ['email' => 'limited@example.test', 'password' => 'incorrect-password'];
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', $input)->assertUnauthorized();
        }
        $this->postJson('/api/v1/auth/login', $input)
            ->assertStatus(429)->assertJsonPath('code', 'too_many_requests')->assertHeader('Retry-After');
    }

    public function test_missing_csrf_token_is_rejected_even_with_same_origin_fetch_metadata(): void
    {
        $this->app->instance('env', 'local'); // Enable real CSRF enforcement for this case.
        $this->withHeaders(['Sec-Fetch-Site' => 'same-origin'])
            ->postJson('/api/v1/auth/register', $this->registration())
            ->assertStatus(419)->assertJsonPath('code', 'csrf_mismatch');
    }

    public function test_bearer_tokens_cannot_authenticate_or_query_an_unused_token_table(): void
    {
        $this->withHeaders(['Authorization' => 'Bearer 123|invalid-token'])
            ->getJson('/api/v1/auth/me')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
    }

    public function test_structured_password_input_is_a_validation_error(): void
    {
        $this->postJson('/api/v1/auth/register', $this->registration(['password' => ['unexpected']]))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_registration_has_its_own_persistent_rate_limit(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/register', [])->assertUnprocessable();
        }
        $this->postJson('/api/v1/auth/register', [])->assertStatus(429)->assertHeader('Retry-After');
    }
}
