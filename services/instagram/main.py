from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, TwoFactorRequired
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Instagram Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instagram Client
cl = Client()
is_logged_in = False
current_user = None
SESSION_FILE = "session.json"

# Models
class LoginRequest(BaseModel):
    username: str
    password: str
    verification_code: Optional[str] = None

class SendDMRequest(BaseModel):
    user_id: Optional[str] = None
    thread_id: Optional[str] = None
    message: str

class PostRequest(BaseModel):
    caption: str

# Session management
def save_session():
    if cl.user_id:
        session_data = cl.get_settings()
        with open(SESSION_FILE, "w") as f:
            json.dump(session_data, f)

def load_session():
    global is_logged_in, current_user
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r") as f:
                session_data = json.load(f)
            cl.set_settings(session_data)
            cl.login(session_data.get("username", ""), "")
            is_logged_in = True
            current_user = cl.user_info_by_username(cl.username)
            return True
        except Exception as e:
            print(f"Session load failed: {e}")
            return False
    return False

# Routes

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "instagram": {
            "connected": is_logged_in,
            "username": current_user.username if current_user else None
        }
    }

@app.get("/status")
async def status():
    return {
        "connected": is_logged_in,
        "user": {
            "id": str(current_user.pk) if current_user else None,
            "username": current_user.username if current_user else None,
            "full_name": current_user.full_name if current_user else None,
            "followers": current_user.follower_count if current_user else 0,
            "following": current_user.following_count if current_user else 0,
            "posts": current_user.media_count if current_user else 0,
            "profile_pic": str(current_user.profile_pic_url) if current_user and current_user.profile_pic_url else None
        } if current_user else None
    }

@app.post("/login")
async def login(request: LoginRequest):
    global is_logged_in, current_user
    
    try:
        # Try to login
        cl.login(request.username, request.password, verification_code=request.verification_code)
        is_logged_in = True
        current_user = cl.user_info_by_username(request.username)
        save_session()
        
        return {
            "success": True,
            "user": {
                "id": str(current_user.pk),
                "username": current_user.username,
                "full_name": current_user.full_name,
                "followers": current_user.follower_count
            }
        }
    except TwoFactorRequired:
        return {"success": False, "error": "two_factor_required", "message": "2FA kodu gerekli"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/logout")
async def logout():
    global is_logged_in, current_user
    
    try:
        cl.logout()
        is_logged_in = False
        current_user = None
        if os.path.exists(SESSION_FILE):
            os.remove(SESSION_FILE)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/profile")
async def get_profile():
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        user = cl.user_info_by_username(cl.username)
        return {
            "success": True,
            "profile": {
                "id": str(user.pk),
                "username": user.username,
                "full_name": user.full_name,
                "biography": user.biography,
                "followers": user.follower_count,
                "following": user.following_count,
                "posts": user.media_count,
                "profile_pic": str(user.profile_pic_url) if user.profile_pic_url else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/posts")
async def get_posts(limit: int = 12):
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        medias = cl.user_medias(cl.user_id, amount=limit)
        posts = []
        for media in medias:
            posts.append({
                "id": str(media.pk),
                "code": media.code,
                "caption": media.caption_text,
                "likes": media.like_count,
                "comments": media.comment_count,
                "media_type": media.media_type,
                "thumbnail": str(media.thumbnail_url) if media.thumbnail_url else None,
                "timestamp": media.taken_at.isoformat() if media.taken_at else None
            })
        return {"success": True, "posts": posts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/posts/upload")
async def upload_post(
    file: UploadFile = File(...),
    caption: str = Form("")
):
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        # Save uploaded file temporarily
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Upload to Instagram
        media = cl.photo_upload(temp_path, caption)
        
        # Clean up
        os.remove(temp_path)
        
        return {
            "success": True,
            "post": {
                "id": str(media.pk),
                "code": media.code,
                "caption": media.caption_text
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dms")
async def get_direct_messages():
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        threads = cl.direct_threads(amount=20)
        dms = []
        for thread in threads:
            last_message = thread.messages[0] if thread.messages else None
            users = [u.username for u in thread.users]
            dms.append({
                "thread_id": str(thread.id),
                "users": users,
                "last_message": last_message.text if last_message else None,
                "timestamp": last_message.timestamp.isoformat() if last_message and last_message.timestamp else None,
                "unread": not thread.read_state
            })
        return {"success": True, "dms": dms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dms/{thread_id}")
async def get_dm_messages(thread_id: str, limit: int = 20):
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        messages = cl.direct_messages(thread_id, amount=limit)
        formatted = []
        for msg in messages:
            formatted.append({
                "id": str(msg.id),
                "text": msg.text,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "user_id": str(msg.user_id),
                "is_me": str(msg.user_id) == str(cl.user_id)
            })
        return {"success": True, "messages": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/dms/send")
async def send_dm(request: SendDMRequest):
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        if request.thread_id:
            # Thread ID ile gönder
            result = cl.direct_send(request.message, thread_ids=[int(request.thread_id)])
        elif request.user_id:
            # User ID ile gönder (yeni konuşma başlatır)
            result = cl.direct_send(request.message, user_ids=[int(request.user_id)])
        else:
            raise HTTPException(status_code=400, detail="thread_id veya user_id gerekli")
        
        return {
            "success": True, 
            "message_id": str(result.id) if result else None,
            "thread_id": str(result.thread_id) if result and hasattr(result, 'thread_id') else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/followers")
async def get_followers(limit: int = 50):
    if not is_logged_in:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    try:
        followers = cl.user_followers(cl.user_id, amount=limit)
        result = []
        for user_id, user in followers.items():
            result.append({
                "id": str(user_id),
                "username": user.username,
                "full_name": user.full_name
            })
        return {"success": True, "followers": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Try to load existing session on startup
@app.on_event("startup")
async def startup():
    load_session()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
