using System;
using Kristijandraca.IsBurnerEmail;
using Xunit;

namespace Kristijandraca.IsBurnerEmail.Tests;

public class IsBurnerEmailTests : IDisposable
{
    public void Dispose()
    {
        IsBurnerEmail.RemoveFromBlacklist("runtime-block.example");
        IsBurnerEmail.RemoveFromWhitelist("runtime-allow.example");
        IsBurnerEmail.RemoveFromWhitelist("simplelogin.com");
        IsBurnerEmail.RemoveFromBlacklist("contested.example");
        IsBurnerEmail.RemoveFromWhitelist("contested.example");
        IsBurnerEmail.RemoveFromBlacklist("badguy.example");
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("@example.com")]
    [InlineData("foo@")]
    [InlineData("foo@localhost")]
    public void InvalidEmails_ReturnInvalidReason(string email)
    {
        var r = IsBurnerEmail.Check(email);
        Assert.Equal("invalid-email", r.Reason);
        Assert.False(r.Burner);
        Assert.Null(r.Domain);
        Assert.Null(r.List);
    }

    [Fact]
    public void NullEmail_ReturnsInvalidReason()
    {
        var r = IsBurnerEmail.Check(null);
        Assert.Equal("invalid-email", r.Reason);
    }

    [Fact]
    public void LowercaseAndTrim()
    {
        var r = IsBurnerEmail.Check("  User@GMail.COM  ");
        Assert.Equal("gmail.com", r.Domain);
    }

    [Fact]
    public void Whitelisted()
    {
        var r = IsBurnerEmail.Check("user@gmail.com");
        Assert.False(r.Burner);
        Assert.Equal(IsBurnerEmail.ListWhitelist, r.List);
        Assert.Equal("whitelisted", r.Reason);
    }

    [Fact]
    public void WhitelistOverridesBothModes()
    {
        Assert.False(IsBurnerEmail.IsBurner("user@gmail.com", IsBurnerEmail.ModeNormal));
        Assert.False(IsBurnerEmail.IsBurner("user@gmail.com", IsBurnerEmail.ModeStrict));
    }

    [Fact]
    public void GraylistNormal()
    {
        var r = IsBurnerEmail.Check("user@duck.com", IsBurnerEmail.ModeNormal);
        Assert.False(r.Burner);
        Assert.Equal(IsBurnerEmail.ListGraylist, r.List);
        Assert.Equal("graylisted-normal", r.Reason);
    }

    [Fact]
    public void GraylistStrict()
    {
        var r = IsBurnerEmail.Check("user@duck.com", IsBurnerEmail.ModeStrict);
        Assert.True(r.Burner);
        Assert.Equal(IsBurnerEmail.ListGraylist, r.List);
        Assert.Equal("graylisted-strict", r.Reason);
    }

    [Fact]
    public void DefaultModeIsNormal()
    {
        Assert.False(IsBurnerEmail.IsBurner("user@mozmail.com"));
        Assert.True(IsBurnerEmail.IsBurner("user@mozmail.com", IsBurnerEmail.ModeStrict));
    }

    [Fact]
    public void UnknownDomain()
    {
        var r = IsBurnerEmail.Check("user@definitely-not-in-any-list-xyz.example");
        Assert.False(r.Burner);
        Assert.Null(r.List);
        Assert.Equal("unknown", r.Reason);
    }

    [Fact]
    public void RuntimeBlacklist()
    {
        const string d = "runtime-block.example";
        Assert.False(IsBurnerEmail.IsBurner("user@" + d));
        IsBurnerEmail.AddToBlacklist(d);
        var r = IsBurnerEmail.Check("user@" + d);
        Assert.True(r.Burner);
        Assert.Equal(IsBurnerEmail.ListBlacklist, r.List);
    }

    [Fact]
    public void WhitelistRescuesGraylistedInStrictMode()
    {
        const string d = "simplelogin.com";
        Assert.True(IsBurnerEmail.IsBurner("user@" + d, IsBurnerEmail.ModeStrict));
        IsBurnerEmail.AddToWhitelist(d);
        Assert.False(IsBurnerEmail.IsBurner("user@" + d, IsBurnerEmail.ModeStrict));
        IsBurnerEmail.RemoveFromWhitelist(d);
        Assert.True(IsBurnerEmail.IsBurner("user@" + d, IsBurnerEmail.ModeStrict));
    }

    [Fact]
    public void WhitelistWinsOverBlacklist()
    {
        const string d = "contested.example";
        IsBurnerEmail.AddToBlacklist(d);
        IsBurnerEmail.AddToWhitelist(d);
        Assert.False(IsBurnerEmail.IsBurner("user@" + d));
    }

    [Fact]
    public void NormalizesCasingAndWhitespace()
    {
        IsBurnerEmail.AddToBlacklist("  BadGuy.EXAMPLE  ");
        Assert.True(IsBurnerEmail.IsBurner("user@badguy.example"));
    }

    [Fact]
    public void ListSizes_AllNonZero()
    {
        var sizes = IsBurnerEmail.GetListSizes();
        Assert.True(sizes.Blacklist > 0);
        Assert.True(sizes.Whitelist > 0);
        Assert.True(sizes.Graylist > 0);
    }
}
