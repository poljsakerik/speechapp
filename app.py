"""Run with: streamlit run app.py"""

import hashlib

import streamlit as st

from speechapp.pipeline import analyze

st.set_page_config(page_title="Speech coach", page_icon="🎙️", layout="centered")
st.title("Speech coach")
st.write("Upload a short English speech to review rate, volume, pitch and melody, tonality, and pauses in context.")
st.caption("Audio is sent to Deepgram for transcription and Mistral for coaching. Recordings longer than one minute are reviewed using the centered one-minute excerpt.")

uploaded = st.file_uploader("Speech recording", type=["wav", "mp3", "m4a", "mp4", "webm"])
if uploaded is not None:
    audio_bytes = uploaded.getvalue()
    upload_id = hashlib.sha256(audio_bytes).hexdigest()
    st.audio(uploaded)
    if st.button("Review", type="primary"):
        try:
            with st.spinner("Listening and reviewing all five foundations…"):
                st.session_state["analysis"] = analyze(audio_bytes)
                st.session_state["upload_id"] = upload_id
        except Exception as exc:
            st.session_state.pop("analysis", None)
            st.error(f"The review could not be completed: {exc}")

analysis = st.session_state.get("analysis")
if analysis and uploaded is not None and upload_id == st.session_state.get("upload_id"):
    st.subheader("Review")
    st.caption("Timestamps refer to the selected excerpt.")
    st.json(analysis["review"], expanded=2)
    st.caption("Audio reviewed by Mistral")
    st.audio(analysis["audio"], format="audio/mpeg")
    with st.expander("Transcript"):
        for segment in analysis["segments"]:
            st.write(f"{int(segment['start']//60):02d}:{int(segment['start']%60):02d}  {segment['text']}")
