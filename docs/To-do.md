--Tighten spacing between sections by a few more pixels.

--Drag and Drop of audio files isn't working.  The cursor change to say "+Copy" appears when you hit the drop target, but nothing happens

>Add an Activation node under the Help menu in the menubar that pops up licensing information 
>--Header text stating either "Activated" or "Trial Version"
>--Machine ID
>--Customer Information (Name, Email Address, Date Activated)
>----The field labels should always exist
>----Greyed out italicized "Unlicensed" as the field values if not activated
>--Purchase License button that launches  Activation Modal (disabled if activated)
>--Product Webpage https://muvid.sorryneedboost.com

--remove the "disabled when audio not loaded" state from the licensing features

--Add a "Theme" node under the View menu, below the separater, above "Toggle Full Screen" that allows switching between Dark/Light/Auto (see next line)
--Add an "Auto" option for themes that detects whether windows is in Light or Dark mode and chooses the theme consistent with that, make this the default
--Remove the Theme selection DDL from the Preview Section Header

--Re-label the Preview section as "Project" and move New, Load, Save, Save-As, Render, Cancel and Orientation buttons as well as the elapsed time and Render progress indicator up there.
----Except for Render and Cancel buttons, remove text from buttons (icons only)
----use icon-project-new.png and icon-project-new-light.png for the new project button

--Make the Render and Cancel buttons' visibility mutually exclusive to save space (like Play/Pause)
--Make the landscape and portrait buttons mutually exclusive in the same way 
--add to the menubar unlicense (under "activation" in the help menu) and clear logs (under render and cancel render in the file menu)
--remove the unlicense and clear logs buttons


--Leave the Render section at the bottom (where the logs are generated), but have it hidden by default
--Add to menubar "Toggle Logs" under View menu to show/hide them
--Remove Notes Section
--move the "Trial Edition:....." disabled/dimmming/linking to the activation modal up there as well, since that's where the buttons will now be, and will be easier to find for a new user
--reduce top padding of section headers by 3px
--Ensure that section text (such as "No Items in Library" or "No Clips. Use Add Video.....") are left-aligned with section labels

--have window height auto-adjust based on content (adjusting whenever layers are added or sections are collapsed/expanded)


--Since layer data auto-saves to allow for realtime preview of changes, the OK and Cancel buttons don't seem like they make sense. Especially the cancel button, as it doesn't really cancel changes made, unless I'm missing something?
----The only real purpose I see for the OK button is when first adding a layer via one of the layer-add buttons, as it does not automatically create the layer until you click OK. 
----I'm proposing that we have the layer created as soon as you click the add button, just like when you click duplicate and then
------replace OK and Cancel with a "Close" button, to hide the properties panel
------add an "undo" button (and therefore a redo button would also likely be needed for consistency with other applications

--change "Click to select Audio File" text to "Drag file or click to browse", increase letter-spacing to 2px,  and put an outline around it (using pill-style border-radius) that includes the Load Audio button area, effectively creating a target area for dragging (only visible when an audio file is not loaded)

--adjust redraws while previewing to reduce flashing blank white in between frames (possibly changing the ordering of layers during compositing? if we need to look into this futher, that's fine)

--allow preview viewport to be resized by dragging the bottom of the top section down