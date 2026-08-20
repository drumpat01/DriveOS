@{
    Severity = @('Error')

    # JourneyDeck intentionally converts already-received secret strings into
    # SecureString instances at process and persistence boundaries. Treating
    # every one of those conversions as a new defect would hide useful results.
    ExcludeRules = @('PSAvoidUsingConvertToSecureStringWithPlainText')
}
