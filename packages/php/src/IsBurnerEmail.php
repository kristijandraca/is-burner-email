<?php

declare(strict_types=1);

namespace Kristijandraca\IsBurnerEmail;

/**
 * Fast, offline burner / disposable email detection.
 *
 * Public API is static:
 *   IsBurnerEmail::isBurner($email, $mode = 'normal')
 *   IsBurnerEmail::check($email, $mode = 'normal')
 *   IsBurnerEmail::addToBlacklist($domain)
 *   IsBurnerEmail::addToWhitelist($domain)
 *   IsBurnerEmail::removeFromBlacklist($domain)
 *   IsBurnerEmail::removeFromWhitelist($domain)
 *   IsBurnerEmail::getListSizes()
 */
final class IsBurnerEmail
{
    public const MODE_NORMAL = 'normal';
    public const MODE_STRICT = 'strict';

    public const LIST_BLACKLIST = 'blacklist';
    public const LIST_WHITELIST = 'whitelist';
    public const LIST_GRAYLIST = 'graylist';

    /** @var array<string, bool> */
    private static array $blacklist = [];
    /** @var array<string, bool> */
    private static array $whitelist = [];
    /** @var array<string, bool> */
    private static array $graylist = [];
    /** @var array<string, bool> */
    private static array $runtimeBlacklist = [];
    /** @var array<string, bool> */
    private static array $runtimeWhitelist = [];

    private static bool $initialized = false;

    private static function init(): void
    {
        if (self::$initialized) {
            return;
        }
        $dataDir = __DIR__ . '/../data';
        self::$blacklist = self::loadSet($dataDir . '/blacklist.txt');
        self::$whitelist = self::loadSet($dataDir . '/whitelist.txt');
        self::$graylist = self::loadSet($dataDir . '/graylist.txt');
        self::$initialized = true;
    }

    /**
     * @return array<string, bool>
     */
    private static function loadSet(string $path): array
    {
        $set = [];
        $fh = @fopen($path, 'r');
        if ($fh === false) {
            return $set;
        }
        try {
            while (($line = fgets($fh)) !== false) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $set[strtolower($line)] = true;
            }
        } finally {
            fclose($fh);
        }

        return $set;
    }

    private static function normalize(string $s): string
    {
        return strtolower(trim($s));
    }

    public static function extractDomain(mixed $email): ?string
    {
        if (!is_string($email)) {
            return null;
        }
        $trimmed = trim($email);
        $at = strrpos($trimmed, '@');
        if ($at === false || $at === 0 || $at === strlen($trimmed) - 1) {
            return null;
        }
        $domain = strtolower(substr($trimmed, $at + 1));
        if (!str_contains($domain, '.')) {
            return null;
        }

        return $domain;
    }

    /**
     * @return array{burner: bool, domain: ?string, list: ?string, reason: string}
     */
    public static function check(string $email, string $mode = self::MODE_NORMAL): array
    {
        self::init();
        $domain = self::extractDomain($email);
        if ($domain === null) {
            return ['burner' => false, 'domain' => null, 'list' => null, 'reason' => 'invalid-email'];
        }

        if (isset(self::$runtimeWhitelist[$domain]) || isset(self::$whitelist[$domain])) {
            return ['burner' => false, 'domain' => $domain, 'list' => self::LIST_WHITELIST, 'reason' => 'whitelisted'];
        }

        if (isset(self::$runtimeBlacklist[$domain]) || isset(self::$blacklist[$domain])) {
            return ['burner' => true, 'domain' => $domain, 'list' => self::LIST_BLACKLIST, 'reason' => 'blacklisted'];
        }

        if (isset(self::$graylist[$domain])) {
            if ($mode === self::MODE_STRICT) {
                return ['burner' => true, 'domain' => $domain, 'list' => self::LIST_GRAYLIST, 'reason' => 'graylisted-strict'];
            }

            return ['burner' => false, 'domain' => $domain, 'list' => self::LIST_GRAYLIST, 'reason' => 'graylisted-normal'];
        }

        return ['burner' => false, 'domain' => $domain, 'list' => null, 'reason' => 'unknown'];
    }

    public static function isBurner(string $email, string $mode = self::MODE_NORMAL): bool
    {
        return self::check($email, $mode)['burner'];
    }

    public static function addToBlacklist(string $domain): void
    {
        self::$runtimeBlacklist[self::normalize($domain)] = true;
    }

    public static function addToWhitelist(string $domain): void
    {
        self::$runtimeWhitelist[self::normalize($domain)] = true;
    }

    public static function removeFromBlacklist(string $domain): bool
    {
        $d = self::normalize($domain);
        if (isset(self::$runtimeBlacklist[$d])) {
            unset(self::$runtimeBlacklist[$d]);
            return true;
        }

        return false;
    }

    public static function removeFromWhitelist(string $domain): bool
    {
        $d = self::normalize($domain);
        if (isset(self::$runtimeWhitelist[$d])) {
            unset(self::$runtimeWhitelist[$d]);
            return true;
        }

        return false;
    }

    /**
     * @return array{blacklist: int, whitelist: int, graylist: int}
     */
    public static function getListSizes(): array
    {
        self::init();

        return [
            'blacklist' => count(self::$blacklist),
            'whitelist' => count(self::$whitelist),
            'graylist' => count(self::$graylist),
        ];
    }
}
