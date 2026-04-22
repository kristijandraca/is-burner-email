<?php

declare(strict_types=1);

namespace Kristijandraca\IsBurnerEmail\Tests;

use Kristijandraca\IsBurnerEmail\IsBurnerEmail;
use PHPUnit\Framework\TestCase;

final class IsBurnerEmailTest extends TestCase
{
    protected function tearDown(): void
    {
        IsBurnerEmail::removeFromBlacklist('runtime-block.example');
        IsBurnerEmail::removeFromWhitelist('runtime-allow.example');
        IsBurnerEmail::removeFromBlacklist('gmail.com');
        IsBurnerEmail::removeFromWhitelist('simplelogin.com');
        IsBurnerEmail::removeFromBlacklist('contested.example');
        IsBurnerEmail::removeFromWhitelist('contested.example');
        IsBurnerEmail::removeFromBlacklist('badguy.example');
    }

    public function testInvalidEmail(): void
    {
        $this->assertSame('invalid-email', IsBurnerEmail::check('')['reason']);
        $this->assertSame('invalid-email', IsBurnerEmail::check('not-an-email')['reason']);
        $this->assertSame('invalid-email', IsBurnerEmail::check('@example.com')['reason']);
        $this->assertSame('invalid-email', IsBurnerEmail::check('foo@')['reason']);
        $this->assertSame('invalid-email', IsBurnerEmail::check('foo@localhost')['reason']);
    }

    public function testLowercaseAndTrim(): void
    {
        $this->assertSame('gmail.com', IsBurnerEmail::check('  User@GMail.COM  ')['domain']);
    }

    public function testWhitelist(): void
    {
        $r = IsBurnerEmail::check('user@gmail.com');
        $this->assertFalse($r['burner']);
        $this->assertSame('whitelist', $r['list']);
        $this->assertSame('whitelisted', $r['reason']);
    }

    public function testWhitelistOverridesBothModes(): void
    {
        $this->assertFalse(IsBurnerEmail::isBurner('user@gmail.com', IsBurnerEmail::MODE_NORMAL));
        $this->assertFalse(IsBurnerEmail::isBurner('user@gmail.com', IsBurnerEmail::MODE_STRICT));
    }

    public function testGraylistNormal(): void
    {
        $r = IsBurnerEmail::check('user@duck.com', IsBurnerEmail::MODE_NORMAL);
        $this->assertFalse($r['burner']);
        $this->assertSame('graylist', $r['list']);
        $this->assertSame('graylisted-normal', $r['reason']);
    }

    public function testGraylistStrict(): void
    {
        $r = IsBurnerEmail::check('user@duck.com', IsBurnerEmail::MODE_STRICT);
        $this->assertTrue($r['burner']);
        $this->assertSame('graylist', $r['list']);
        $this->assertSame('graylisted-strict', $r['reason']);
    }

    public function testDefaultModeIsNormal(): void
    {
        $this->assertFalse(IsBurnerEmail::isBurner('user@mozmail.com'));
        $this->assertTrue(IsBurnerEmail::isBurner('user@mozmail.com', IsBurnerEmail::MODE_STRICT));
    }

    public function testUnknownDomain(): void
    {
        $r = IsBurnerEmail::check('user@definitely-not-in-any-list-xyz.example');
        $this->assertFalse($r['burner']);
        $this->assertNull($r['list']);
        $this->assertSame('unknown', $r['reason']);
    }

    public function testRuntimeBlacklist(): void
    {
        $this->assertFalse(IsBurnerEmail::isBurner('user@runtime-block.example'));
        IsBurnerEmail::addToBlacklist('runtime-block.example');
        $r = IsBurnerEmail::check('user@runtime-block.example');
        $this->assertTrue($r['burner']);
        $this->assertSame('blacklist', $r['list']);
    }

    public function testWhitelistRescuesGraylisted(): void
    {
        $this->assertTrue(IsBurnerEmail::isBurner('user@simplelogin.com', IsBurnerEmail::MODE_STRICT));
        IsBurnerEmail::addToWhitelist('simplelogin.com');
        $this->assertFalse(IsBurnerEmail::isBurner('user@simplelogin.com', IsBurnerEmail::MODE_STRICT));
        IsBurnerEmail::removeFromWhitelist('simplelogin.com');
        $this->assertTrue(IsBurnerEmail::isBurner('user@simplelogin.com', IsBurnerEmail::MODE_STRICT));
    }

    public function testWhitelistWinsOverBlacklist(): void
    {
        IsBurnerEmail::addToBlacklist('contested.example');
        IsBurnerEmail::addToWhitelist('contested.example');
        $this->assertFalse(IsBurnerEmail::isBurner('user@contested.example'));
    }

    public function testNormalizesCasingAndWhitespace(): void
    {
        IsBurnerEmail::addToBlacklist('  BadGuy.EXAMPLE  ');
        $this->assertTrue(IsBurnerEmail::isBurner('user@badguy.example'));
    }

    public function testListSizes(): void
    {
        $sizes = IsBurnerEmail::getListSizes();
        $this->assertGreaterThan(0, $sizes['blacklist']);
        $this->assertGreaterThan(0, $sizes['whitelist']);
        $this->assertGreaterThan(0, $sizes['graylist']);
    }
}
