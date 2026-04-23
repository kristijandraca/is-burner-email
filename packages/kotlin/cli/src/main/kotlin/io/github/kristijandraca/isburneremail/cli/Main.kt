package io.github.kristijandraca.isburneremail.cli

import io.github.kristijandraca.isburneremail.IsBurnerEmail
import io.github.kristijandraca.isburneremail.Mode
import kotlin.system.exitProcess

private const val HELP_TEXT = """burner — burner / disposable email detection

Usage:
  burner <email> [--strict] [--json]
  burner --stats
  burner --help

Options:
  --strict    Use strict mode (graylisted domains are treated as disposable)
  --json      Output full check result as JSON
  --stats     Print the sizes of the bundled lists
  -h, --help  Show this help

Exit codes:
  0  not a burner
  1  burner
  2  invalid input / error
"""

private fun jsonEscape(s: String): String {
    val sb = StringBuilder(s.length + 2)
    for (c in s) {
        when (c) {
            '\\' -> sb.append("\\\\")
            '"' -> sb.append("\\\"")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            else -> if (c.code < 0x20) sb.append("\\u%04x".format(c.code)) else sb.append(c)
        }
    }
    return sb.toString()
}

private fun jsonValue(v: Any?): String = when (v) {
    null -> "null"
    is Boolean -> v.toString()
    is Number -> v.toString()
    is String -> "\"${jsonEscape(v)}\""
    else -> "\"${jsonEscape(v.toString())}\""
}

private fun jsonObject(pairs: List<Pair<String, Any?>>): String =
    pairs.joinToString(separator = ",", prefix = "{", postfix = "}") { (k, v) -> "\"$k\":${jsonValue(v)}" }

public fun main(args: Array<String>) {
    var strict = false
    var asJson = false
    var stats = false
    var help = false
    var email: String? = null

    for (arg in args) {
        when (arg) {
            "-h", "--help" -> help = true
            "--strict" -> strict = true
            "--json" -> asJson = true
            "--stats" -> stats = true
            else -> if (email == null && !arg.startsWith("-")) email = arg
        }
    }

    if (help) {
        print(HELP_TEXT)
        exitProcess(0)
    }

    if (stats) {
        val sizes = IsBurnerEmail.getListSizes()
        if (asJson) {
            println(jsonObject(listOf(
                "blacklist" to sizes.blacklist,
                "whitelist" to sizes.whitelist,
                "graylist" to sizes.graylist,
            )))
        } else {
            println("blacklist: ${sizes.blacklist}")
            println("whitelist: ${sizes.whitelist}")
            println("graylist:  ${sizes.graylist}")
        }
        exitProcess(0)
    }

    if (email == null) {
        System.err.println("Error: missing email argument")
        System.err.println()
        System.err.print(HELP_TEXT)
        exitProcess(2)
    }

    val mode = if (strict) Mode.STRICT else Mode.NORMAL
    val result = IsBurnerEmail.check(email, mode)

    if (result.reason == "invalid-email") {
        System.err.println("Error: invalid email: $email")
        exitProcess(2)
    }

    if (asJson) {
        println(jsonObject(listOf(
            "burner" to result.burner,
            "domain" to result.domain,
            "list" to result.list?.value,
            "reason" to result.reason,
            "mode" to mode.value,
        )))
    } else {
        val label = if (result.burner) "BURNER" else "OK"
        val listInfo = result.list?.let { " (${it.value})" } ?: ""
        println("$label$listInfo: ${result.domain} [${result.reason}]")
    }

    exitProcess(if (result.burner) 1 else 0)
}
