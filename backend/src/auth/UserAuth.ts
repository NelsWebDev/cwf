import * as  yup from 'yup';
import { User } from '../users/User';
import { Socket } from '../types';
export class UserAuth {

    static async login(body: Record<string, any>) {
        const schema = new yup.ObjectSchema({
            email: yup.string().email().required(),
            password: yup.string().required().matches(/fuckyou/, "Invalid password"),
        });
        try {
            await schema.validate(body);
            const user = await User.find({email: body.email});
            if(!user) {
                throw new Error("Email not registered");
            }
            return user.toJSON();
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static async logout(socket: Socket) {
        socket.data.disconnect();
    }

}