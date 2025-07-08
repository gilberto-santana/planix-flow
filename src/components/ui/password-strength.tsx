import { Progress } from "./progress";
import { validatePasswordStrength, getPasswordStrengthColor, getPasswordStrengthText } from "@/utils/passwordValidation";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = validatePasswordStrength(password);
  
  if (!password) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Progress 
          value={(strength.score / 4) * 100} 
          className="flex-1 h-2"
        />
        <span className={`text-xs font-medium ${getPasswordStrengthColor(strength.score)}`}>
          {getPasswordStrengthText(strength.score)}
        </span>
      </div>
      
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {strength.feedback.map((feedback, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              {feedback}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}