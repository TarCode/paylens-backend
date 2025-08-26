import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { GoogleProfile } from '../models/User';

// Configure Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
        },
        (accessToken: string, refreshToken: string, profile: any, done: any) => {
            try {
                // Extract profile information
                const googleProfile: GoogleProfile = {
                    id: profile.id,
                    email: profile.emails[0].value,
                    verified_email: profile.emails[0].verified,
                    name: profile.displayName,
                    given_name: profile.name.givenName,
                    family_name: profile.name.familyName,
                    picture: profile.photos[0].value,
                    locale: profile._json.locale,
                };

                return done(null, googleProfile);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

// Serialize user for session (we don't use sessions, but passport requires this)
passport.serializeUser((user: any, done) => {
    done(null, user);
});

// Deserialize user from session (we don't use sessions, but passport requires this)
passport.deserializeUser((user: any, done) => {
    done(null, user);
});

export default passport;
