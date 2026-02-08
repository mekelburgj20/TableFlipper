iScored API
version 0.6a
Introduction
This document describes the iScored API, which allows external applications to programmatically interact with iScored.   Apps such as pinball machines, virtual pins, video games, or other programs can retrieve data from iScored, or post data to iScored.

A link to the latest version of this document can always be found at https://www.iScored.info/api/

What is iScored?
iScored is a web application that tracks high scores for a given location or community. When launched in 2017, it was initially aimed primarily at the pinball community, but over time, through countless upgrades, has grown in size, scope, and capability and has been adopted by operators and enthusiasts in the video arcade and virtual pin communities as well.

The screen displaying these high scores is known as a "gameroom".  Some typical gamerooms are shown below.

 





iScored gamerooms are extremely customizable with myriad options and settings.  By default, the content automatically scrolls from left to right to gradually show all of the games within a gameroom.  The game columns can be configured with custom graphics and fonts.

An iScored account is obtained by signing up at https://www.iScored.info and paying a one-time fee for lifetime access.  There is no subscription or recurring charges.  While an account is needed to host an iScored gameroom, posting a score to a gameroom as a player does not require any kind of fee, account, registration, or app download.  It's designed so that any new player can easily submit a score while standing at the machine they just played, and see their name show up on the iScored scoreboard.  Typically, this is achieved by using their phone to scan a QR code attached to the game, which launches the score entry screen for that game.  Touchscreen kiosks, tablet devices, and laptops are also sometimes used for score entry.

By implementing the iScored API described in this document, game creators can make this process even more effortless by posting player scores to iScored directly from within their games.

The iScored API
First and foremost, in order to interact with the iScored API, you must enable access in your gameroom settings.  


Retrieving General Gameroom Data
To retrieve general data about a gameroom, send a request to:

https://www.iscored.info/api/gameroomName

where "gameroomName" is the user name associated with an iScored account. This will return a JSON object containing an array of all the games within that gameroom, as well as all the settings associated with that gameroom.




Retrieving Game High Score Data
To retrieve the high scores of a specific game, send a request to:

https://www.iscored.info/api/gameroomName/gameName

where "gameroomName" is the user name associated with an iScored account, and "gameName" is the name of one of the games in their gameroom.  This request should be URL-encoded, since the game name may contain spaces or other special characters.

This request returns a JSON object containing the top 10 scores and names for that game, in the following format:
{
  "gameName":"Weird Al",
  "GameID":"39550",
  "scores":[
    {
      "name":"PEZ",
      "date":"2023-08-18 16:37:50",
      "rank":"1",
      "score":"27890220"
    },
    {
      "name":"KENZIE",
      "date":"2023-08-18 20:29:46",
      "rank":"2",
      "score":"2562364"
    }
  ]
}

This method also accepts the “max” parameter, which specifies the maximum number of scores to return.  If “max” is not specified, the iScored API returns 10 results by default.  If “max” is set to zero, it will retrieve all scores for that game.

To retrieve high score data for ALL of your games, send a request to:
https://www.iscored.info/api/gameroomName/getAllScores

This request returns a JSON object containing an array of all scores for all games.  This method does not support the “max” parameter (at least not yet).

Submitting Scores
To submit a score to iScored, send a POST request to:

https://www.iscored.info/api/gameroomName/gameNameOrId/submitScore

where "gameroomName" is the user name associated with an iScored account, and "gameNameOrId" is the name of a game in their gameroom, or the ID of a game in their gameroom.  This request should be URL-encoded, since the game name may contain spaces or other special characters.

The POST request must contain the "playerName" and "score" parameters.  These parameters can be specified in the request body OR via parameters on the URL.

The "playerName" parameter has a max length of 25 characters, and may include numbers, letters, spaces, and underscores.

The "score" parameter must be an integer, but can be 0 or negative.  iScored also supports time-based scoring.  If the game in question has time-based scoring enabled, the "score" parameter should be an integer representing the time in milliseconds.

A successful score submission returns a JSON object containing the top 10 names and high scores for that game, as well as the one just submitted.  This response is identical to the response described above in the Retrieving Game High Score Data section, but also includes a “submittedScore” attribute that contains data such as rank about the score that was submitted.  Just like the above method, submitScores also accepts the “max” parameter, limiting the number of results returned:

{
  "gameName":"Weird Al",
  "GameID":"39550",
  "scores":[
    {
      "name":"PEZ",
      "date":"2023-08-18 16:37:50",
      "rank":"1",
      "score":"27890220"
    },
    {
      "name":"KENZIE",
      "date":"2023-08-18 20:29:46",
      "rank":"2",
      "score":"2562364"
    }
  ],
  "submittedScore":{
    "name":"PEZ",
    "rank":"1",
    "score":"27890220"
  }
}

An unsuccessful score submission will return an error message.

A score will be denied if there is already a score present for the specified player, AND the existing score is higher than the score attempting to be submitted.  iScored only keeps track of each player's top score, therefore it will not overwrite a higher score with a lower one through the API.

A score will also be denied if the specified game or gameroom does not exist, if the specified gameroom does not have sufficient access rights, or if the "score" or "playerName" parameters are missing or invalid.

Creating Events
To create an iScored Event, send a POST request to:

https://www.iscored.info/api/gameroomName/createEvent

where "gameroomName" is the user name associated with an iScored account.  This request should be URL-encoded, since the game name may contain spaces or other special characters.

The POST request must contain the "eventName" parameter.  This parameter can be specified in the request body OR via parameter on the URL.

A successful event creation action returns a JSON object containing eventId, eventName, and eventStatus (which will always be “Stopped” at this point).  The eventId is needed to start and stop the Event.

Starting and Stopping Events
To start or stop an event, send a POST request to:

https://www.iscored.info/api/gameroomName/startEvent
or
https://www.iscored.info/api/gameroomName/stopEvent

The POST request must contain the "eventId" parameter.  This parameter can be specified in the request body OR via parameter on the URL.
