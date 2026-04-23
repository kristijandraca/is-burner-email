package io.github.kristijandraca.isburneremail

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class IsBurnerEmailTest {

    @AfterEach
    fun cleanup() {
        IsBurnerEmail.removeFromBlacklist("runtime-block.example")
        IsBurnerEmail.removeFromWhitelist("runtime-allow.example")
        IsBurnerEmail.removeFromWhitelist("simplelogin.com")
        IsBurnerEmail.removeFromBlacklist("contested.example")
        IsBurnerEmail.removeFromWhitelist("contested.example")
        IsBurnerEmail.removeFromBlacklist("badguy.example")
    }

    @ParameterizedTest
    @ValueSource(strings = ["", "not-an-email", "@example.com", "foo@", "foo@localhost"])
    fun `invalid emails return invalid-email reason`(email: String) {
        val r = IsBurnerEmail.check(email)
        assertEquals("invalid-email", r.reason)
        assertFalse(r.burner)
        assertNull(r.domain)
        assertNull(r.list)
    }

    @Test
    fun `null email returns invalid-email reason`() {
        val r = IsBurnerEmail.check(null)
        assertEquals("invalid-email", r.reason)
    }

    @Test
    fun `lowercases and trims`() {
        val r = IsBurnerEmail.check("  User@GMail.COM  ")
        assertEquals("gmail.com", r.domain)
    }

    @Test
    fun `whitelisted`() {
        val r = IsBurnerEmail.check("user@gmail.com")
        assertFalse(r.burner)
        assertEquals(ListName.WHITELIST, r.list)
        assertEquals("whitelisted", r.reason)
    }

    @Test
    fun `whitelist overrides both modes`() {
        assertFalse(IsBurnerEmail.isBurner("user@gmail.com", Mode.NORMAL))
        assertFalse(IsBurnerEmail.isBurner("user@gmail.com", Mode.STRICT))
    }

    @Test
    fun `graylist normal`() {
        val r = IsBurnerEmail.check("user@duck.com", Mode.NORMAL)
        assertFalse(r.burner)
        assertEquals(ListName.GRAYLIST, r.list)
        assertEquals("graylisted-normal", r.reason)
    }

    @Test
    fun `graylist strict`() {
        val r = IsBurnerEmail.check("user@duck.com", Mode.STRICT)
        assertTrue(r.burner)
        assertEquals(ListName.GRAYLIST, r.list)
        assertEquals("graylisted-strict", r.reason)
    }

    @Test
    fun `default mode is normal`() {
        assertFalse(IsBurnerEmail.isBurner("user@mozmail.com"))
        assertTrue(IsBurnerEmail.isBurner("user@mozmail.com", Mode.STRICT))
    }

    @Test
    fun `unknown domain`() {
        val r = IsBurnerEmail.check("user@definitely-not-in-any-list-xyz.example")
        assertFalse(r.burner)
        assertNull(r.list)
        assertEquals("unknown", r.reason)
    }

    @Test
    fun `runtime blacklist`() {
        val d = "runtime-block.example"
        assertFalse(IsBurnerEmail.isBurner("user@$d"))
        IsBurnerEmail.addToBlacklist(d)
        val r = IsBurnerEmail.check("user@$d")
        assertTrue(r.burner)
        assertEquals(ListName.BLACKLIST, r.list)
    }

    @Test
    fun `whitelist rescues graylisted in strict mode`() {
        val d = "simplelogin.com"
        assertTrue(IsBurnerEmail.isBurner("user@$d", Mode.STRICT))
        IsBurnerEmail.addToWhitelist(d)
        assertFalse(IsBurnerEmail.isBurner("user@$d", Mode.STRICT))
        IsBurnerEmail.removeFromWhitelist(d)
        assertTrue(IsBurnerEmail.isBurner("user@$d", Mode.STRICT))
    }

    @Test
    fun `whitelist wins over blacklist`() {
        val d = "contested.example"
        IsBurnerEmail.addToBlacklist(d)
        IsBurnerEmail.addToWhitelist(d)
        assertFalse(IsBurnerEmail.isBurner("user@$d"))
    }

    @Test
    fun `normalizes casing and whitespace`() {
        IsBurnerEmail.addToBlacklist("  BadGuy.EXAMPLE  ")
        assertTrue(IsBurnerEmail.isBurner("user@badguy.example"))
    }

    @Test
    fun `list sizes are non zero`() {
        val sizes = IsBurnerEmail.getListSizes()
        assertTrue(sizes.blacklist > 0)
        assertTrue(sizes.whitelist > 0)
        assertTrue(sizes.graylist > 0)
    }
}
