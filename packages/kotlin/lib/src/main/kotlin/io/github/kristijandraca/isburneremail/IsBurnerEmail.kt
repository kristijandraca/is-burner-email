package io.github.kristijandraca.isburneremail

public enum class Mode(public val value: String) {
    NORMAL("normal"),
    STRICT("strict"),
    ;

    public companion object {
        public fun fromString(value: String): Mode = when (value) {
            "strict" -> STRICT
            else -> NORMAL
        }
    }
}

public enum class ListName(public val value: String) {
    BLACKLIST("blacklist"),
    WHITELIST("whitelist"),
    GRAYLIST("graylist"),
}

public data class CheckResult(
    val burner: Boolean,
    val domain: String?,
    val list: ListName?,
    val reason: String,
)

public data class ListSizes(
    val blacklist: Int,
    val whitelist: Int,
    val graylist: Int,
)

public object IsBurnerEmail {
    private val blacklist: Set<String> = loadEmbedded("blacklist.txt")
    private val whitelist: Set<String> = loadEmbedded("whitelist.txt")
    private val graylist: Set<String> = loadEmbedded("graylist.txt")

    private val runtimeBlacklist: MutableSet<String> = mutableSetOf()
    private val runtimeWhitelist: MutableSet<String> = mutableSetOf()
    private val runtimeLock = Any()

    private fun loadEmbedded(name: String): Set<String> {
        val stream = IsBurnerEmail::class.java.classLoader.getResourceAsStream(name)
            ?: error("Embedded resource '$name' not found on classpath.")
        val set = mutableSetOf<String>()
        stream.bufferedReader(Charsets.UTF_8).useLines { lines ->
            for (line in lines) {
                val trimmed = line.trim()
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue
                set.add(trimmed.lowercase())
            }
        }
        return set
    }

    private fun normalize(value: String): String = value.trim().lowercase()

    private fun extractDomain(email: String?): String? {
        if (email == null) return null
        val trimmed = email.trim()
        val at = trimmed.lastIndexOf('@')
        if (at <= 0 || at == trimmed.length - 1) return null
        val domain = trimmed.substring(at + 1).lowercase()
        if ('.' !in domain) return null
        return domain
    }

    @JvmStatic
    @JvmOverloads
    public fun check(email: String?, mode: Mode = Mode.NORMAL): CheckResult {
        val domain = extractDomain(email)
            ?: return CheckResult(false, null, null, "invalid-email")

        val rWhite: Boolean
        val rBlack: Boolean
        synchronized(runtimeLock) {
            rWhite = domain in runtimeWhitelist
            rBlack = domain in runtimeBlacklist
        }

        if (rWhite || domain in whitelist) {
            return CheckResult(false, domain, ListName.WHITELIST, "whitelisted")
        }

        if (rBlack || domain in blacklist) {
            return CheckResult(true, domain, ListName.BLACKLIST, "blacklisted")
        }

        if (domain in graylist) {
            return if (mode == Mode.STRICT) {
                CheckResult(true, domain, ListName.GRAYLIST, "graylisted-strict")
            } else {
                CheckResult(false, domain, ListName.GRAYLIST, "graylisted-normal")
            }
        }

        return CheckResult(false, domain, null, "unknown")
    }

    @JvmStatic
    @JvmOverloads
    public fun isBurner(email: String?, mode: Mode = Mode.NORMAL): Boolean = check(email, mode).burner

    @JvmStatic
    public fun addToBlacklist(domain: String) {
        synchronized(runtimeLock) { runtimeBlacklist.add(normalize(domain)) }
    }

    @JvmStatic
    public fun addToWhitelist(domain: String) {
        synchronized(runtimeLock) { runtimeWhitelist.add(normalize(domain)) }
    }

    @JvmStatic
    public fun removeFromBlacklist(domain: String): Boolean =
        synchronized(runtimeLock) { runtimeBlacklist.remove(normalize(domain)) }

    @JvmStatic
    public fun removeFromWhitelist(domain: String): Boolean =
        synchronized(runtimeLock) { runtimeWhitelist.remove(normalize(domain)) }

    @JvmStatic
    public fun getListSizes(): ListSizes = ListSizes(blacklist.size, whitelist.size, graylist.size)
}
