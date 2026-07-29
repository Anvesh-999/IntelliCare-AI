def generate_lifestyle_advice(metrics: dict) -> dict:
    """
    Analyzes BMI, Blood Pressure, Blood Sugar, Weight, and Activity Level
    to generate custom, educational health and wellness coaching recommendations.
    """
    bmi = float(metrics.get("bmi", 22.0))
    bp_sys = int(metrics.get("blood_pressure_systolic", 120))
    bp_dia = int(metrics.get("blood_pressure_diastolic", 80))
    sugar = float(metrics.get("blood_sugar", 90.0))  # fasting
    activity = metrics.get("activity_level", "moderate").lower()
    
    advice_items = []
    category_summary = {}
    
    # 1. BMI Assessment
    if bmi < 18.5:
        category_summary["BMI"] = "Underweight"
        advice_items.append("Focus on nutrient-dense, calorie-dense foods (healthy fats, protein, whole grains) to gradually build lean mass.")
    elif 18.5 <= bmi < 25.0:
        category_summary["BMI"] = "Healthy Weight"
        advice_items.append("Excellent! Maintain your current metabolic health through a balanced intake of protein, complex carbs, and fiber.")
    elif 25.0 <= bmi < 30.0:
        category_summary["BMI"] = "Overweight"
        advice_items.append("Aim for a caloric deficit of 300-500 kcal/day. Incorporate strength training to maintain muscle while losing fat.")
    else:
        category_summary["BMI"] = "Obese"
        advice_items.append("Consistently tracking meals and scheduling regular physical activity can greatly support weight management. Discuss goals with a nutritionist.")

    # 2. Blood Pressure Assessment
    if bp_sys >= 140 or bp_dia >= 90:
        category_summary["Blood Pressure"] = "Hypertension (Stage 2)"
        advice_items.append("Limit sodium intake below 1,500 mg per day. Practice stress-relief techniques like deep breathing, meditation, or yoga.")
    elif 130 <= bp_sys < 140 or 80 <= bp_dia < 90:
        category_summary["Blood Pressure"] = "Hypertension (Stage 1)"
        advice_items.append("Engage in regular aerobic exercise (brisk walking, swimming) and increase potassium-rich foods (bananas, sweet potatoes, spinach).")
    elif 120 <= bp_sys < 130 and bp_dia < 80:
        category_summary["Blood Pressure"] = "Elevated"
        advice_items.append("Focus on the DASH diet (high in vegetables, fruits, lean proteins) to support arterial health.")
    else:
        category_summary["Blood Pressure"] = "Normal"
        advice_items.append("Your blood pressure is within the healthy range. Continue limiting processed foods and maintaining high hydration.")

    # 3. Blood Sugar (Fasting) Assessment
    if sugar >= 126.0:
        category_summary["Fasting Glucose"] = "High (Hyperglycemia / Diabetic Range)"
        advice_items.append("Focus on low-glycemic index foods. Strictly limit refined sugars and simple carbs. Prioritize consistency in meal times.")
    elif 100.0 <= sugar < 126.0:
        category_summary["Fasting Glucose"] = "Elevated (Pre-Diabetic Range)"
        advice_items.append("Reduce sugar intake and highly processed foods. Ensure meals are balanced with fiber and protein to prevent insulin spikes.")
    else:
        category_summary["Fasting Glucose"] = "Normal"
        advice_items.append("Your blood sugar levels are healthy. Maintain fiber-rich carbohydrate sources (beans, oats, brown rice).")

    # 4. Activity Level suggestions
    if activity in ["sedentary", "low"]:
        advice_items.append("Start with a goal of 10-15 minutes of brisk walking after lunch or dinner. Gradually increase by 5 minutes each week.")
    elif activity in ["moderate"]:
        advice_items.append("Keep up the good work! Aim for at least 150 minutes of moderate activity weekly, combined with 2 days of strength training.")
    else:
        advice_items.append("Fantastic activity levels! Make sure you allow adequate rest and recovery days to prevent physical fatigue or joint strain.")

    return {
        "status": category_summary,
        "coaching_tips": advice_items,
        "score": "Good" if len(category_summary) > 0 else "Average",
        "disclaimer": "These lifestyle guidelines are wellness recommendations and do not substitute for clinical management."
    }

def generate_meal_plan(preferences: dict, health_info: dict) -> dict:
    """
    Generates a structured daily/weekly meal suggestion list based on diet preference
    (e.g. Vegetarian, Keto, Low Carb, Balanced) and health conditions (e.g. Diabetic, Hypertension).
    """
    diet_pref = preferences.get("diet_preference", "balanced").lower()
    conditions = [c.lower() for c in health_info.get("conditions", [])]
    
    # Custom adjustments based on conditions
    is_low_sodium = "hypertension" in conditions or "heart condition" in conditions
    is_low_sugar = "diabetes" in conditions or "prediabetes" in conditions
    
    # Default Balanced Menu
    breakfast = "Oatmeal with berries, chia seeds, and a scoop of protein powder."
    lunch = "Grilled chicken salad with mixed greens, cherry tomatoes, cucumbers, and olive oil vinaigrette."
    snack = "A handful of raw almonds and an apple."
    dinner = "Baked salmon with steamed broccoli and quinoa."
    
    if diet_pref == "vegetarian":
        breakfast = "Greek yogurt with honey, walnuts, and sliced banana (or tofu scramble with spinach)."
        lunch = "Quinoa bowl with black beans, roasted sweet potatoes, avocado, and lime-tahini dressing."
        snack = "Carrot sticks with hummus."
        dinner = "Lentil curry with brown rice and roasted cauliflower."
    elif diet_pref == "keto":
        breakfast = "Scrambled eggs in butter with spinach, avocado, and sugar-free bacon."
        lunch = "Tuna salad with celery and full-fat mayonnaise over a bed of spinach."
        snack = "Macadamia nuts or celery sticks with cream cheese."
        dinner = "Ribeye steak with garlic butter and grilled asparagus."
    elif diet_pref == "low carb" or diet_pref == "low-carb":
        breakfast = "Egg white omelet with mushrooms, peppers, and avocado."
        lunch = "Sliced turkey breast rollups with lettuce, tomato, and avocado-mayo."
        snack = "Cottage cheese with cucumber slices."
        dinner = "Grilled chicken breast with zoodles (zucchini noodles) in basil pesto."

    # Adjustments for health constraints
    if is_low_sugar:
        # Swap simple sugars/high-glycemic items
        breakfast = breakfast.replace("honey", "cinnamon").replace("banana", "blueberries")
        dinner = dinner.replace("brown rice", "cauliflower rice").replace("sweet potatoes", "roasted zucchini")
        lunch = lunch.replace("quinoa", "kale and hemp seeds")
        
    if is_low_sodium:
        # Explicit warning about dressings/cured meats
        breakfast = breakfast.replace("bacon", "sliced tomato")
        lunch = lunch.replace("vinaigrette", "lemon squeeze and olive oil (low-salt)")
        dinner = dinner.replace("garlic butter", "garlic olive oil and herbs")

    return {
        "preferences": {
            "diet": diet_pref.capitalize(),
            "low_sodium_required": is_low_sodium,
            "low_sugar_required": is_low_sugar
        },
        "daily_meal_plan": {
            "Breakfast": breakfast,
            "Lunch": lunch,
            "Snack": snack,
            "Dinner": dinner
        },
        "hydration_target": "2.5 - 3.0 Liters of water daily.",
        "nutritional_focus": "High protein, high fiber, low saturated fats" if is_low_sodium or is_low_sugar else "Balanced macronutrient ratios"
    }
