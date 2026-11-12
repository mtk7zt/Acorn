*** Settings ***
Documentation     Read-only smoke tests for the Acorn Core FastAPI API.
Library           RequestsLibrary
Library           Collections
Suite Setup       Create Session    acorn    ${BASE_URL}    timeout=15

*** Variables ***
${BASE_URL}       http://127.0.0.1:8000

*** Test Cases ***
Health Endpoint Is Healthy
    ${response}=    GET On Session    acorn    /v1/health    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Should Be Equal    ${body}[status]    healthy
    Should Be Equal    ${body}[version]    2.0.0
    Dictionary Should Contain Key    ${body}    total_opportunities

Signals Endpoint Returns A List
    ${response}=    GET On Session    acorn    /v1/signals    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body, list)

Activity Endpoint Returns A List
    ${response}=    GET On Session    acorn    url=/v1/activity?limit=5    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Should Be True    isinstance($body, list)

Latest Briefing Has Expected Fields
    ${response}=    GET On Session    acorn    /v1/briefings/latest    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    headline
    Dictionary Should Contain Key    ${body}    signals
    Should Be True    isinstance($body['signals'], list)

Unknown Signal Cannot Be Modified
    ${payload}=    Create Dictionary    action=saved
    ${response}=    POST On Session    acorn    /v1/signals/nonexistent-smoke-test-signal/action    json=${payload}    expected_status=404
    Should Be Equal    ${response.json()}[detail]    Signal not found
