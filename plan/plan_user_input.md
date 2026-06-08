ai  does not edit user_input  it creates a own plan in plan_ai folder


Tech Stack:  
-  web app    node typescript, tailwind creating reusable classes and components, standard  
-  mutli client / user server
-  logic and ai calls decision   are on server as main functionionality  not api not in client web,  state in db or cached files, server is   stateless  .
-  absolutely no hacks  standard setups standard libraries standard use
-  localstandard node deployement
-  cloudflair and  , https://www.lernspass.net/  https://aitutor.lernspass.net/  or other domains configured later   standard setup over    automatic deployement from git
- app runs from / root or  apps/aitutor/
- design  web and mobile   light  cloudflair style, icons and all that
- PWA
- switch ai chat listen voice providers 
- question can on ios or android the onboard ai be used also?
- test in different browsers  and android and ipad and iphone

Build a French or other language or  topic like History  voice training app that stays out of the user's way. The app listens, captures practice sentences, corrects French, and only speaks when the user explicitly asks.

now the reason i want this    is not gpt chat is not good enough it is  gpt chat  cant stay out of the way and stay silent  
can you tell  me short  is  it possible to interfere and stop response or question except it is lets say i ask keyword computer or press a button   but then he respondes        we are in this folder do not change anything outside  C:\dev\rtx_ai_voice_trainer


can you build a chat app  with voice listen and  response   

1. I want a Chat  
2. I want a toggle to activate LISTEN
3. i want a button toggle to activate SPEAK     
4. I need  Voice in, text + optional voice     
   the idea is  to collect the conversation text history of few talks (delete older dont pile memory or files or db)
   1. history collect text of few back talks text and correction texts
   2. ai listener should return  { text: orig, text:corrected  , keywordsent 1 0  or true false,  maybe more computer readable infos later } + voice    so a structured response
5. important oor ai only speaks if asked by keyword  or button  otherwise it stays silent,   once activated and user asks a question to AI directly it can answer in chat style full talk, then silent minimal again


Features Simple Use
2 Toggle buttons  LISTEN  and  SPEAK
- settings   
  -   switch providers
  -   see edit prompts about style of answer or topic 
  -   see fixed system prompts like the instruction about json and general behaviour rules etc
  - debug see system errors, see entire listen request answer activity with detail messages and restult
  - track costs over time with db
- 
- listen    when active ai listens and send notes about has improvment  or  has mistakes to correct 
- ai allways send json computer evaluatable response with exact fields values for  signaling has corrections etc
- in that a message text to the user is added and shown to user
- the signals has improvement or mistackes are signaled ove a status color lamp or some nice way
- listen and debug keep track of past 5 messages
- if SPEAK is off corrections just come in chat message,  if SPEAK is on voice corrects the User about the last 1 mistake
- aslo a keyword  computer activates  computer off deactivates  the SPEAK, ai sends if keyword on off is sent and ignores it in its corrections
-  messages and voice are short  just the corrected  plus short hint why,  as short as possible  the user can  ask for detail info  then the ai can speak more detailed chat






MY EXPECTATION

CLIENT
   SYSTEM_AUDIO_TO_TEXT
   SYSTEM_TEXT_TO_AUDIO
  SYSTEM_MICRO_TO_AUDIO
  SYSTEM_AUDIO_TO_SPEAKER


SERVER


 PRIMITIVE METHODS
   PRIMITIVE_TEXT_TO_AUDIO
       input
	       CHOICE OF PROVIDER
		   system prompt  additonal instructions
		   text
		   history
		output
		   audio
		   json 
		      analysis  flags maybe later added
			  
   		
   PRIMITIVE_AUDIO_TO_TEXT
       input
	       CHOICE OF PROVIDER
		   system prompt  additonal instructions
		   text chat
		   audio
		   history
		output
		   audio
		   json 
		      text
			  hint
		      analysis  flags maybe later added
OUR REAL METHOD
INPUT
      SYSTEM Prompt
	         task  (corretcing text how  short ,.... )
			 response JSON format and howto
      TEXT user chat
	  AUDIO  user AUDIO
	  history 5 last text chats
	  
OUTPUT
     json
	     flags  (keyword, has corrections, ischatanswerOrCorrection, ...)
		 chat text to user
		 text_corrected
		 hint
	 audio