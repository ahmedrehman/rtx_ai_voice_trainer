# Modules


# Core functionalities are created in application side client or server modules, they can be called pure over methods the whole logic is in the methods not spread over ui or apis.

## methods  define what the do with clear thing to thing name
voice_to_text
### complete list of input
 bulletpooints short with explanation, short complete and  clear human understandable the actual role of that thing
 example:
 input:
 - audio //   the audio file usually from micro of browser
 - prompt  // system prompts plus user input
         -  system prompt depends on 
            -  usecase method call //  configured for each call type ... in config files,
            -  common part of system prompt //definind the return json structure,fields and possible values, and idea how AI should fill them. our comuter evaluateable  protocoll so to say.
  - output
    -   output is wrapped json
        -   status (containing success or errors in standard fields)
        -  text   the result ai chat text
        -  flags set by AI  as specified in system prompts
## Modularity enforcement
- all module methods get all parameters they dont fetch db config by themselves, there is specific methods to look up configs by tape or data to provide to the methods but the method does only one clear thing no mix of accessing differnet modules and code. Input taks output   
- the module exposes public ponjects methods to use, internal code is not accessible. a clear defined border  best enforced by public and private files wher public has no logic just types and interface objects exposed.

- IMPORTANT NO HACKS, no fast fixes, NO WOrkarounds, No duplicate Execution Paths,  and thing that does not immediately clearly fit tothe current structure and ideals   ASK USER  do never implement dirty quick fixes  Everything has a library
- IMPORTANT   YOU MARLK CLEAR NOT IMPLEMENTED   you never pretend something is there or ready  You dont cheat me 
- TEST AND VISUALISE proove the module structure is enforced and implemented   There should be a test UI page for each Modules with its methods one by one to visualise document and check each method. because so far this structure has allways been broken by AI and the result projekt got unmaintainable because it used to bekome a heap of double.  The User should be able to quickly understand see the method click it understand allit s input

as test i expect
such a structure  busines AIMS  RESULT    REASON    detail expandable
BUSINES TARGET:      LISTENING TO VOICE
       MEANS RECORDING      AVCTIVE    5000ms chunks REPEATING ENDLESS
                 CHECKING SILENCE    NOT IMPLEMENTED SKIP
                  CHECKING VOICE   NOT IMPLEMENTD SKIP
                 CHECKING NBROWSER VOICE TO SPEACH       TARGET SKIP OR USE CHUNK
                              REQUEST      FR       (WILL IT REMARK ENGISH?)
                                      RESULT    HAS TEXT  
                                              result json  klick to open
                             CHUNK SENT    to AI  FUCTION ....   
                                   request  full   klick to expand
                                   response full  click to expand
                                                HAS CORRECXTION
       RECORDING   ENDED     REASON   USER CLICKED STOP

-  All methods return additional status in their wrapped returns
-  All errors are tracked handled and logged additionally, the list of error events can be displayed any time, it is an array
- all execution steps (method calls) inputs results  are tracked as array of json objetcs with known type,  and can be displayed as objects with types at any time inspectable in a debug view.

## dokumentation is for humans  top down
not a huge list of dokumenations. but clear structure

TOP most Busines aims

  - level 1 what idt does how - main modules   purpose how it solves issue   short bulletpoints with remark clarifying again short
       level 2  main methods exposed  the relly core that make the thing
              level 3 
                 other necessary methods and details 
                 exact datastructures, namings, examples   short precise   the important only others just noted 

human should be able to verify  and see misunderstandings without reading a book. 
WE USE Ids in db  we use standards  we use best prectice we use standard libraries. NO dirty quick solutions otherwise clearly tell USER, do never  silently break the quality and make quick fixes this has broken many projekts

then top down technical helper modules utilities and so on




# Module Architecture Agreement

## Core Rule

- Modules contain the real functionality.
- UI only calls module methods and displays returned objects.
- API routes only translate HTTP <-> module calls.
- Methods get all inputs directly.
- Methods do not fetch DB, settings, prompts, or config by themselves.

## Prompt And Config Rule

- Prompt/config lookup is an app/data concern.
- The app loads prompts/config from DB or storage.
- The app passes prompts/config into module methods.

Example method input:

- `systemPrompt`
- `taskPrompt`
- `responseJsonFormat`
- `history`
- `textUserChat`
- `audio`

## Method Naming

- Method names must say clearly what they do.

Examples:

- `SYSTEM_MEANINGFUL_AUDIO_CHUNK`
- `PRIMITIVE_AUDIO_TO_TEXT`
- `PRIMITIVE_TEXT_TO_AUDIO`
- `AUDIO_TO_AI_TEXT_AND_AUDIO`
- `AUDIO_ANALYSER`
- `DATA_STORE_SAVE_EVENT`

## Method Return Rule

Every method returns wrapped output:

- `status`
- `data/json/audio/text`
- `debug`

## Standard Status

Every method returns `status`:

- `method`
- `ok`
- `phase`
- `startedAt`
- `finishedAt`
- `error`

## Debug Tracking

Every method call can create a debug item:

- `type`
- `method`
- `input`
- `output`
- `status`
- `error`
- `createdAt`

## Error Rule

- Errors are handled.
- Errors are returned in `status`.
- Errors are also logged as debug items.
- Error events are stored in an array.
- Error events can be displayed at any time.

## Execution Flow Rule

- All execution steps are tracked as JSON objects.
- Inputs are inspectable.
- Outputs are inspectable.
- Status is inspectable.
- Errors are inspectable.

## Modularity Enforcement

- Modules expose public methods and public types.
- Internal code stays private.
- Public files should expose interfaces/types/methods.
- No module reaches into another module’s storage/config/settings.
- No duplicate execution paths.

## Test And Debug UI

- There should be a test/debug UI page for each module.
- Each module page shows its methods one by one.
- User can click a method.
- User can see:
  - method role
  - all inputs
  - all prompts
  - output
  - status
  - errors
  - debug data

## No Hacks

- No fast fixes.
- No workarounds.
- No hidden logic in UI.
- No hidden logic in API routes.
- No duplicate paths.
- If something does not fit the structure, ask first.