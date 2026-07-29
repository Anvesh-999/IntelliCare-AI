from datetime import datetime

def generate_medical_timeline(events: list) -> list:
    """
    Takes list of event objects (prescriptions, reports, appointments, diagnoses, notes)
    and structures them into a sorted chronological history timeline.
    """
    timeline_events = []
    
    for event in events:
        try:
            # Extract standard fields
            event_type = event.get("type", "General")
            date_val = event.get("date")
            title = event.get("title", "Medical Event")
            description = event.get("description", "")
            meta = event.get("metadata", {})
            source = event.get("source", "System")
            
            # Standardize date format to parse
            parsed_date = None
            if isinstance(date_val, str):
                # Handle ISO timestamps or standard YYYY-MM-DD
                for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                    try:
                        parsed_date = datetime.strptime(date_val, fmt)
                        break
                    except ValueError:
                        continue
            elif isinstance(date_val, datetime):
                parsed_date = date_val
                
            if not parsed_date:
                parsed_date = datetime.utcnow()
                
            # Classify styling variables for UI representation (e.g., color, icons)
            color = "blue"
            icon = "Activity"
            if event_type.lower() == "prescription":
                color = "emerald"
                icon = "Pill"
            elif event_type.lower() == "report":
                color = "purple"
                icon = "FileText"
            elif event_type.lower() == "appointment":
                color = "indigo"
                icon = "Calendar"
            elif event_type.lower() == "diagnosis":
                color = "rose"
                icon = "ShieldAlert"
            elif event_type.lower() == "clinical_note":
                color = "amber"
                icon = "Clipboard"
                
            timeline_events.append({
                "id": event.get("_id", event.get("id")),
                "type": event_type,
                "date": parsed_date.strftime("%Y-%m-%d"),
                "datetime_iso": parsed_date.isoformat(),
                "title": title,
                "description": description,
                "metadata": meta,
                "source": source,
                "style": {
                    "color": color,
                    "icon": icon
                }
            })
        except Exception as e:
            print(f"[Timeline] Error parsing event: {str(e)}")
            continue
            
    # Sort chronological: descending order (newest first)
    timeline_events.sort(key=lambda x: x["datetime_iso"], reverse=True)
    return timeline_events
